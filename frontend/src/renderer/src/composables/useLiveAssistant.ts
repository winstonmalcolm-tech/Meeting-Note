import { ref } from 'vue'
import type { DesktopSource } from './useScreenRecorder'

export type LiveStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'error'
export type LiveMode = 'interview' | 'meeting'

// Module-level — persists across tab navigation
const isActive = ref(false)
const isPaused = ref(false)
const status = ref<LiveStatus>('idle')
const mode = ref<LiveMode>('interview')
const liveTranscript = ref('')
const lastResponse = ref('')
const error = ref('')

const CHUNK_INTERVAL_MS = 250

let ws: WebSocket | null = null
let micStream: MediaStream | null = null
let systemStream: MediaStream | null = null
let audioCtx: AudioContext | null = null
let mediaRecorder: MediaRecorder | null = null
let overlayCommandCleanup: (() => void) | null = null
let bannerCommandCleanup: (() => void) | null = null
let solveScreenCleanup: (() => void) | null = null

// Solution history for banner prev/next navigation
const solutions: string[] = []
let solutionIndex = -1

function wsUrl(): string {
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
  const wsBase = apiBase.replace(/^https/, 'wss').replace(/^http/, 'ws')
  const token = localStorage.getItem('mn_token') ?? ''
  return `${wsBase}/live?mode=${mode.value}&provider=openrouter&token=${encodeURIComponent(token)}`
}

function sendToOverlay(event: { type: string; [key: string]: unknown }): void {
  window.api.sendAiOverlayEvent(event)
}

function sendToBanner(event: { type: string; [key: string]: unknown }): void {
  window.api.sendBannerEvent(event)
}

async function solveScreen(imageBase64: string): Promise<void> {
  sendToOverlay({ type: 'status', status: 'thinking' })
  sendToOverlay({ type: 'ai_thinking' })
  window.api.showAiOverlay()

  try {
    const token = localStorage.getItem('mn_token') ?? ''
    const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
    const res = await fetch(`${apiBase}/api/solve-screen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-provider': 'openrouter',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ imageBase64 })
    })
    if (!res.ok) {
      const body = await res.json() as { error?: string }
      throw new Error(body.error ?? 'Solve screen failed')
    }
    const { answer } = await res.json() as { answer: string }

    solutions.push(answer)
    solutionIndex = solutions.length - 1

    sendToOverlay({ type: 'ai_token', token: answer })
    sendToOverlay({ type: 'ai_done' })
    sendToOverlay({ type: 'status', status: isActive.value ? 'listening' : 'idle' })
    sendToBanner({ type: 'solve-done', count: solutions.length, index: solutionIndex })
  } catch (err) {
    sendToOverlay({ type: 'status', status: 'error' })
    sendToBanner({ type: 'solve-error' })
    console.error('[useLiveAssistant] solve-screen:', err)
  }
}

function navigateSolution(delta: number): void {
  const next = solutionIndex + delta
  if (next < 0 || next >= solutions.length) return
  solutionIndex = next
  sendToOverlay({ type: 'reset' })
  sendToOverlay({ type: 'ai_token', token: solutions[solutionIndex] })
  sendToOverlay({ type: 'ai_done' })
  sendToBanner({ type: 'nav-update', count: solutions.length, index: solutionIndex })
}

export function useLiveAssistant() {
  async function start(withSystemAudio = true, selectedSource?: DesktopSource): Promise<void> {
    if (isActive.value) return
    error.value = ''
    status.value = 'connecting'
    sendToOverlay({ type: 'status', status: 'connecting' })

    try {
      if (mode.value === 'interview') {
        await startInterview(selectedSource)
      } else {
        await startMeeting(withSystemAudio, selectedSource)
      }

      // ── WebSocket ──────────────────────────────────────────────────────────
      ws = new WebSocket(wsUrl())
      ws.binaryType = 'arraybuffer'

      await new Promise<void>((resolve, reject) => {
        ws!.onopen = () => resolve()
        ws!.onerror = () => reject(new Error('Could not connect to backend'))
        setTimeout(() => reject(new Error('Connection timed out')), 5000)
      })

      ws.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data as string) as { type: string; [key: string]: unknown }
          handleServerEvent(event)
        } catch { /* ignore malformed */ }
      }

      ws.onclose = () => { if (isActive.value) stop() }
      ws.onerror = () => {
        error.value = 'Connection lost'
        status.value = 'error'
        sendToOverlay({ type: 'status', status: 'error' })
        stop()
      }

      // ── MediaRecorder ──────────────────────────────────────────────────────
      let streamToRecord: MediaStream
      if (mode.value === 'interview') {
        streamToRecord = systemStream!
      } else {
        const dest = audioCtx!.createMediaStreamDestination()
        if (micStream) audioCtx!.createMediaStreamSource(micStream).connect(dest)
        if (systemStream) audioCtx!.createMediaStreamSource(systemStream).connect(dest)
        streamToRecord = dest.stream
      }

      mediaRecorder = new MediaRecorder(streamToRecord, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws?.readyState === WebSocket.OPEN) {
          e.data.arrayBuffer().then((buf) => ws?.send(buf))
        }
      }
      mediaRecorder.start(CHUNK_INTERVAL_MS)

      isActive.value = true
      isPaused.value = false
      solutions.length = 0
      solutionIndex = -1
      status.value = 'listening'
      sendToOverlay({ type: 'status', status: 'listening' })
      sendToOverlay({ type: 'reset' })
      window.api.showAiOverlay()
      window.api.showBanner()
      sendToBanner({ type: 'state', isPaused: false })

      overlayCommandCleanup = window.api.onAiOverlayCommand((cmd) => {
        if (cmd === 'stop' || cmd === 'close') stop()
      })

      bannerCommandCleanup = window.api.onBannerCommand((cmd) => {
        if (cmd === 'stop') stop()
        if (cmd === 'toggle-pause') togglePause()
        if (cmd === 'prev') navigateSolution(-1)
        if (cmd === 'next') navigateSolution(1)
      })

      solveScreenCleanup = window.api.onSolveScreenCapture((imageBase64) => {
        void solveScreen(imageBase64)
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start'
      status.value = 'error'
      sendToOverlay({ type: 'status', status: 'error' })
      cleanup()
    }
  }

  async function startInterview(selectedSource?: DesktopSource): Promise<void> {
    let screen = selectedSource
    if (!screen) {
      const sources = await window.api.getDesktopSources()
      screen = sources.find((s) => s.id.startsWith('screen:')) ?? sources[0]
    }
    if (!screen) throw new Error('No audio source found. Join a meeting first.')

    const raw = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: screen.id } } as MediaTrackConstraints,
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: screen.id } } as MediaTrackConstraints
    })
    raw.getVideoTracks().forEach((t) => t.stop())
    if (raw.getAudioTracks().length === 0) {
      raw.getTracks().forEach((t) => t.stop())
      throw new Error('Could not capture system audio. Ensure a meeting is playing audio.')
    }
    systemStream = raw
  }

  async function startMeeting(withSystemAudio: boolean, selectedSource?: DesktopSource): Promise<void> {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    audioCtx = new AudioContext()

    if (withSystemAudio) {
      try {
        let screen = selectedSource
        if (!screen) {
          const sources = await window.api.getDesktopSources()
          screen = sources.find((s) => s.id.startsWith('screen:')) ?? sources[0]
        }
        if (screen) {
          const raw = await navigator.mediaDevices.getUserMedia({
            audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: screen.id } } as MediaTrackConstraints,
            video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: screen.id } } as MediaTrackConstraints
          })
          raw.getVideoTracks().forEach((t) => t.stop())
          if (raw.getAudioTracks().length > 0) {
            systemStream = raw
          } else {
            raw.getTracks().forEach((t) => t.stop())
          }
        }
      } catch { /* system audio unavailable — mic only */ }
    }
  }

  function handleServerEvent(event: { type: string; [key: string]: unknown }): void {
    if (event.type === 'transcript') {
      liveTranscript.value = (event.text as string) ?? ''
      sendToOverlay(event)
    }

    if (event.type === 'ai_thinking') {
      status.value = 'thinking'
      lastResponse.value = ''
      sendToOverlay({ type: 'status', status: 'thinking' })
      sendToOverlay({ type: 'ai_thinking' })
    }

    if (event.type === 'ai_token') {
      status.value = 'listening'
      lastResponse.value += (event.token as string) ?? ''
      sendToOverlay(event)
    }

    if (event.type === 'ai_done') {
      status.value = 'listening'
      sendToOverlay(event)
    }

    if (event.type === 'error') {
      error.value = (event.message as string) ?? 'Unknown error'
    }
  }

  function sendMessage(text: string): void {
    if (!text.trim() || ws?.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'user_message', text: text.trim() }))
  }

  function togglePause(): void {
    if (!mediaRecorder || !isActive.value) return
    if (isPaused.value) {
      mediaRecorder.resume()
      isPaused.value = false
      status.value = 'listening'
      sendToOverlay({ type: 'status', status: 'listening' })
    } else {
      mediaRecorder.pause()
      isPaused.value = true
      status.value = 'idle'
      sendToOverlay({ type: 'status', status: 'idle' })
    }
    sendToBanner({ type: 'state', isPaused: isPaused.value })
  }

  function stop(): void {
    isPaused.value = false
    cleanup()
    isActive.value = false
    status.value = 'idle'
    liveTranscript.value = ''
    lastResponse.value = ''
    window.api.hideAiOverlay()
    window.api.hideBanner()
    overlayCommandCleanup?.()
    overlayCommandCleanup = null
    bannerCommandCleanup?.()
    bannerCommandCleanup = null
    solveScreenCleanup?.()
    solveScreenCleanup = null
  }

  function cleanup(): void {
    mediaRecorder?.stop()
    mediaRecorder = null
    micStream?.getTracks().forEach((t) => t.stop())
    systemStream?.getTracks().forEach((t) => t.stop())
    audioCtx?.close()
    micStream = null
    systemStream = null
    audioCtx = null
    if (ws?.readyState === WebSocket.OPEN) ws.close()
    ws = null
  }

  return { isActive, isPaused, status, mode, liveTranscript, lastResponse, error, start, stop, togglePause, sendMessage }
}
