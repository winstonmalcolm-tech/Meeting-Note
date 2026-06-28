import 'dotenv/config'
import http from 'http'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import { WebSocketServer } from 'ws'
import audioRouter from './routes/audio'
import extractRouter from './routes/extract'
import requirementsRouter from './routes/requirements'
import chatRouter from './routes/chat'
import screenRecordingsRouter from './routes/screenRecordings'
import collectionsRouter from './routes/collections'
import profileRouter from './routes/profile'
import waitlistRouter from './routes/waitlist'
import authRouter from './routes/auth'
import polarRouter from './routes/polar'
import careerRouter from './routes/career'
import resumeRouter from './routes/resume'
import jobSearchRouter from './routes/jobSearch'
import interviewsRouter from './routes/interviews'
import notificationsRouter from './routes/notifications'
import geoRouter from './routes/geo'
import solveScreenRouter from './routes/solveScreen'
import { getAvailableProviders } from './provider-registry'
import { LiveSession } from './live/session'
import { AuthPayload } from './middleware/auth'

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/meetingnote'
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection failed:', err.message))

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === 'file://' || /^http:\/\/localhost(:\d+)?$/.test(origin) || /^chrome-extension:\/\//.test(origin)) {
      cb(null, true)
    } else {
      cb(null, false)
    }
  }
}))

// Raw body parsers must come before express.json() to prevent body consumption
app.use('/api/transcribe', express.raw({ type: '*/*', limit: '500mb' }))
app.use('/api/polar/webhook', express.raw({ type: '*/*' }))
// Screenshots can be several MB as base64-encoded JSON
app.use('/api/solve-screen', express.json({ limit: '20mb' }))
app.use(express.json())

// Auth & billing — public
app.use('/api', authRouter)
app.use('/api', polarRouter)

// Feature routes
app.use('/api', audioRouter)
app.use('/api', extractRouter)
app.use('/api', requirementsRouter)
app.use('/api', chatRouter)
app.use('/api', screenRecordingsRouter)
app.use('/api', collectionsRouter)
app.use('/api', profileRouter)
app.use('/api', waitlistRouter)
app.use('/api', careerRouter)
app.use('/api', resumeRouter)
app.use('/api', jobSearchRouter)
app.use('/api', interviewsRouter)
app.use('/api', notificationsRouter)
app.use('/api', geoRouter)
app.use('/api', solveScreenRouter)

app.get('/api/providers', (_req, res) => {
  res.json({ available: getAvailableProviders() })
})

app.get('/health', (_req, res) => res.json({ ok: true }))

// Global error handler — must be registered after all routes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled]', err.message, err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

const server = http.createServer(app)

const wss = new WebSocketServer({ server, path: '/live' })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const provider = url.searchParams.get('provider') ?? 'openrouter'
  const rawMode = url.searchParams.get('mode') ?? 'meeting'
  const mode = rawMode === 'interview' ? 'interview' : 'meeting'

  // Verify JWT from query param
  let user: AuthPayload | undefined
  const token = url.searchParams.get('token')
  if (token) {
    try {
      user = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid or expired token' }))
      ws.close()
      return
    }
  }

  let session: LiveSession | null = null
  try {
    session = new LiveSession(ws, provider, mode, user)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start session'
    ws.send(JSON.stringify({ type: 'error', message }))
    ws.close()
    return
  }

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      session?.sendAudio(data as Buffer)
    } else {
      try {
        const msg = JSON.parse(data.toString()) as { type: string; text?: string }
        if (msg.type === 'user_message' && msg.text) {
          session?.handleUserMessage(msg.text)
        }
      } catch { /* ignore malformed control messages */ }
    }
  })

  ws.on('close', () => {
    session?.close()
    session = null
  })

  ws.on('error', (err) => {
    console.error('[WS] client error:', err.message)
    session?.close()
    session = null
  })
})

server.listen(PORT, () => {
  const providers = getAvailableProviders()
  console.log(`Backend running on http://localhost:${PORT}`)
  console.log(`Live WS endpoint: ws://localhost:${PORT}/live`)
  console.log(`Configured providers: ${providers.length ? providers.join(', ') : 'none — set API keys in .env'}`)
})
