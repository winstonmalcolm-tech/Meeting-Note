import https from 'https'
import { WebSocket as WsClient } from 'ws'
import type { WebSocket } from 'ws'
import { streamChat } from './streamChat'
import { streamInterviewChat, type QAPair } from './interviewChat'
import { UserProfile } from '../models/userProfile'
import { User } from '../models/user'
import type { AuthPayload } from '../middleware/auth'

const DEEPGRAM_URL =
  'wss://api.deepgram.com/v1/listen' +
  '?model=nova-2&language=en&smart_format=true&interim_results=true&endpointing=200&utterance_end_ms=1000'

const DEBOUNCE_MS = 2000
const MAX_UTTERANCES = 10
const MAX_QA_HISTORY = 6
const MAX_AI_CALLS_PER_SESSION = 100

const sslAgent = new https.Agent({ rejectUnauthorized: true })

interface UserProfile {
  targetRole: string
  skills: string
  experience: string
}


export class LiveSession {
  private ws: WebSocket
  private provider: string
  private mode: 'interview' | 'meeting'
  private utterances: string[] = []
  private qaHistory: QAPair[] = []
  private currentQuestion = ''
  private accumulatingAnswer = ''
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private aiRunning = false
  private aiCallCount = 0
  private dg: WsClient | null = null
  private audioQueue: Buffer[] = []
  private profile: UserProfile = { targetRole: '', skills: '', experience: '' }

  constructor(ws: WebSocket, provider: string, mode: 'interview' | 'meeting', user?: AuthPayload) {
    this.ws = ws
    this.provider = provider
    this.mode = mode

    // Verify plan from DB — never trust the JWT payload which may be stale
    void this.checkPlanAndInit(user)
  }

  private async checkPlanAndInit(user?: AuthPayload): Promise<void> {
    if (!user?.userId) {
      this.send({ type: 'error', message: 'Authentication required.' })
      setTimeout(() => this.ws.close(), 100)
      return
    }

    const dbUser = await User.findById(user.userId).select('plan planStatus')
    if (!dbUser || dbUser.planStatus !== 'active' || dbUser.plan === 'starter' || !dbUser.plan) {
      this.send({ type: 'error', message: 'Live Assistant requires a Pro or Power plan.' })
      setTimeout(() => this.ws.close(), 100)
      return
    }

    this.initDeepgram()
    if (this.mode === 'interview') void this.loadProfile()
  }

  private async loadProfile(): Promise<void> {
    try {
      const doc = await UserProfile.findOne()
      if (doc) {
        this.profile = {
          targetRole: doc.targetRole,
          skills: doc.skills,
          experience: doc.experience
        }
      }
    } catch (err) {
      console.error('[Session] failed to load profile:', err)
    }
  }

  private initDeepgram(): void {
    const apiKey = process.env.DEEPGRAM_API_KEY
    if (!apiKey) {
      this.send({ type: 'error', message: 'DEEPGRAM_API_KEY not set' })
      return
    }

    const dg = new WsClient(DEEPGRAM_URL, {
      headers: { Authorization: `Token ${apiKey}` },
      agent: sslAgent
    })

    dg.on('open', () => {
      for (const buf of this.audioQueue) dg.send(buf)
      this.audioQueue = []
      this.send({ type: 'status', status: 'listening' })
    })

    dg.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          type: string
          is_final?: boolean
          speech_final?: boolean
          channel?: { alternatives?: Array<{ transcript: string }> }
        }
        if (msg.type !== 'Results') return
        const transcript = msg.channel?.alternatives?.[0]?.transcript
        if (!transcript) return

        this.send({ type: 'transcript', text: transcript, isFinal: msg.is_final ?? false })

        if ((msg.speech_final ?? false) && transcript.trim()) {
          if (this.mode === 'interview') this.currentQuestion = transcript.trim()
          this.addUtterance(transcript.trim())
          this.scheduleAiResponse()
        }
      } catch { /* ignore malformed */ }
    })

    dg.on('error', (err) => {
      console.error('[Deepgram] error:', err.message)
      this.send({ type: 'error', message: 'Transcription error: ' + err.message })
    })

    dg.on('close', (code, reason) => {
      console.log(`[Deepgram] closed: ${code} ${reason}`)
    })

    this.dg = dg
  }

  sendAudio(buffer: Buffer): void {
    if (this.dg?.readyState === WsClient.OPEN) {
      this.dg.send(buffer)
    } else {
      this.audioQueue.push(buffer)
    }
  }

  handleUserMessage(text: string): void {
    this.currentQuestion = text
    this.addUtterance(text)
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    void this.fireAiResponse()
  }

  close(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.dg && this.dg.readyState !== WsClient.CLOSED) this.dg.close()
    this.dg = null
  }

  private addUtterance(text: string): void {
    this.utterances.push(text)
    if (this.utterances.length > MAX_UTTERANCES) this.utterances.shift()
  }

  private scheduleAiResponse(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => void this.fireAiResponse(), DEBOUNCE_MS)
  }

  private async fireAiResponse(): Promise<void> {
    if (this.aiRunning || this.utterances.length === 0) return
    if (this.aiCallCount >= MAX_AI_CALLS_PER_SESSION) {
      this.send({ type: 'status', status: 'ai_limit_reached' })
      return
    }
    this.aiRunning = true
    this.aiCallCount++
    this.accumulatingAnswer = ''
    this.send({ type: 'ai_thinking' })

    try {
      if (this.mode === 'interview') {
        const question = this.currentQuestion || this.utterances[this.utterances.length - 1]
        await streamInterviewChat({
          provider: this.provider,
          targetRole: this.profile.targetRole,
          skills: this.profile.skills,
          experience: this.profile.experience,
          qaHistory: [...this.qaHistory],
          question,
          onToken: (token) => {
            this.accumulatingAnswer += token
            this.send({ type: 'ai_token', token })
          },
          onDone: () => {
            if (this.currentQuestion && this.accumulatingAnswer) {
              this.qaHistory.push({ question: this.currentQuestion, answer: this.accumulatingAnswer })
              if (this.qaHistory.length > MAX_QA_HISTORY) this.qaHistory.shift()
            }
            this.currentQuestion = ''
            this.send({ type: 'ai_done' })
          }
        })
      } else {
        await streamChat(
          this.provider,
          [...this.utterances],
          (token) => this.send({ type: 'ai_token', token }),
          () => this.send({ type: 'ai_done' })
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI error'
      this.send({ type: 'error', message })
    } finally {
      this.aiRunning = false
    }
  }

  private send(event: { type: string; [key: string]: unknown }): void {
    if (this.ws.readyState === WsClient.OPEN) {
      this.ws.send(JSON.stringify(event))
    }
  }
}
