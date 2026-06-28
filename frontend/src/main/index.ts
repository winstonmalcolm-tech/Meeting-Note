import { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell, globalShortcut, screen } from 'electron'
import { join, extname } from 'path'
import { mkdir, writeFile, readFile, readdir, unlink, copyFile, stat } from 'fs/promises'
import { spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'

const recordingsDir = () => join(app.getPath('userData'), 'recordings')
const screenRecordingsDir = () => join(app.getPath('userData'), 'screen-recordings')

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let aiOverlayWindow: BrowserWindow | null = null
let bannerWindow: BrowserWindow | null = null

function createOverlay(): void {
  overlayWindow = new BrowserWindow({
    width: 260,
    height: 52,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    // No parent — must be independent of mainWindow so minimize doesn't hide it
    webPreferences: {
      preload: join(__dirname, '../preload/overlay.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  overlayWindow.setContentProtection(true)
  // 'screen-saver' level keeps it above taskbar and survives main window minimize
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  const overlayHtml = app.isPackaged
    ? join(__dirname, '../renderer/overlay.html')
    : join(__dirname, '../../src/renderer/public/overlay.html')
  overlayWindow.loadFile(overlayHtml)

  overlayWindow.on('closed', () => { overlayWindow = null })
}

function createBannerWindow(): void {
  const { width } = screen.getPrimaryDisplay().workAreaSize
  const bannerWidth = 590

  bannerWindow = new BrowserWindow({
    width: bannerWidth,
    height: 52,
    x: Math.floor((width - bannerWidth) / 2),
    y: 16,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/interview-banner.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  bannerWindow.setContentProtection(true)
  bannerWindow.setAlwaysOnTop(true, 'screen-saver')

  const bannerHtml = app.isPackaged
    ? join(__dirname, '../renderer/interview-banner.html')
    : join(__dirname, '../../src/renderer/public/interview-banner.html')
  bannerWindow.loadFile(bannerHtml)

  bannerWindow.on('closed', () => { bannerWindow = null })
}

function createAiOverlay(): void {
  aiOverlayWindow = new BrowserWindow({
    width: 380,
    height: 320,
    minWidth: 300,
    minHeight: 220,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/ai-overlay.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  aiOverlayWindow.setContentProtection(true)
  aiOverlayWindow.setAlwaysOnTop(true, 'screen-saver')

  const aiOverlayHtml = app.isPackaged
    ? join(__dirname, '../renderer/ai-overlay.html')
    : join(__dirname, '../../src/renderer/public/ai-overlay.html')
  aiOverlayWindow.loadFile(aiOverlayHtml)

  aiOverlayWindow.on('closed', () => { aiOverlayWindow = null })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow!.show())
  mainWindow.on('closed', () => { mainWindow = null })
  // Keep overlays visible when main window is minimized
  mainWindow.on('minimize', () => {
    if (overlayWindow?.isVisible()) {
      overlayWindow.show()
      overlayWindow.setAlwaysOnTop(true, 'screen-saver')
    }
    if (aiOverlayWindow?.isVisible()) {
      aiOverlayWindow.show()
      aiOverlayWindow.setAlwaysOnTop(true, 'screen-saver')
    }
    if (bannerWindow?.isVisible()) {
      bannerWindow.show()
      bannerWindow.setAlwaysOnTop(true, 'screen-saver')
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── Desktop sources (screens + windows, with thumbnails) ───────────────────
ipcMain.handle('get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 }
  })
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL()
  }))
})

// ── Audio recordings ───────────────────────────────────────────────────────
ipcMain.handle('save-recording', async (_e, buffer: ArrayBuffer, meta: object) => {
  const dir = recordingsDir()
  await mkdir(dir, { recursive: true })
  const id = Date.now().toString()
  await writeFile(join(dir, `${id}.webm`), Buffer.from(buffer))
  await writeFile(join(dir, `${id}.json`), JSON.stringify(meta))
  return id
})

ipcMain.handle('list-recordings', async () => {
  const dir = recordingsDir()
  const files = await readdir(dir).catch(() => [] as string[])
  const ids = [...new Set(files.map((f) => f.replace(/\.(webm|json)$/, '')))]
  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        const raw = await readFile(join(dir, `${id}.json`), 'utf-8')
        return { id, ...JSON.parse(raw) }
      } catch {
        return null
      }
    })
  )
  return entries
    .filter(Boolean)
    .sort((a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt)
})

ipcMain.handle('read-recording', async (_e, id: string) => {
  const buf = await readFile(join(recordingsDir(), `${id}.webm`))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
})

ipcMain.handle('update-recording', async (_e, id: string, updates: object) => {
  const metaPath = join(recordingsDir(), `${id}.json`)
  const existing = JSON.parse(await readFile(metaPath, 'utf-8'))
  await writeFile(metaPath, JSON.stringify({ ...existing, ...updates }))
})

ipcMain.handle('delete-recording', async (_e, id: string) => {
  const dir = recordingsDir()
  await Promise.all([
    unlink(join(dir, `${id}.webm`)).catch(() => {}),
    unlink(join(dir, `${id}.json`)).catch(() => {})
  ])
})

// ── Screen recordings ──────────────────────────────────────────────────────
ipcMain.handle('save-screen-recording', async (_e, buffer: ArrayBuffer, meta: object) => {
  const dir = screenRecordingsDir()
  await mkdir(dir, { recursive: true })
  const id = Date.now().toString()
  await writeFile(join(dir, `${id}.webm`), Buffer.from(buffer))
  await writeFile(join(dir, `${id}.json`), JSON.stringify(meta))
  return id
})

ipcMain.handle('list-screen-recordings', async () => {
  const dir = screenRecordingsDir()
  const files = await readdir(dir).catch(() => [] as string[])
  const ids = files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
  const entries = await Promise.all(
    ids.map(async (id) => {
      try {
        const raw = await readFile(join(dir, `${id}.json`), 'utf-8')
        return { id, ...JSON.parse(raw) }
      } catch {
        return null
      }
    })
  )
  return entries
    .filter(Boolean)
    .sort((a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt)
})

ipcMain.handle('read-screen-recording', async (_e, id: string) => {
  const dir = screenRecordingsDir()
  for (const ext of ['.webm', '.mp4', '.mov', '.mkv', '.avi']) {
    try {
      const buf = await readFile(join(dir, `${id}${ext}`))
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    } catch { /* try next */ }
  }
  throw new Error(`Recording file not found: ${id}`)
})

ipcMain.handle('extract-screen-audio', async (_e, id: string): Promise<ArrayBuffer> => {
  const dir = screenRecordingsDir()
  let inputPath: string | null = null
  for (const ext of ['.webm', '.mp4', '.mov', '.mkv', '.avi']) {
    try { await stat(join(dir, `${id}${ext}`)); inputPath = join(dir, `${id}${ext}`); break } catch { /* try next */ }
  }
  if (!inputPath) throw new Error(`Recording file not found: ${id}`)
  const audioCodec = inputPath.endsWith('.webm') ? 'copy' : 'libopus'
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const proc = spawn(ffmpegPath as string, [
      '-i', inputPath!,
      '-vn',
      '-c:a', audioCodec,
      '-f', 'webm',
      'pipe:1'
    ])
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    proc.stderr.on('data', () => {})
    proc.on('close', (code) => {
      if (code === 0) {
        const buf = Buffer.concat(chunks)
        resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`))
      }
    })
    proc.on('error', reject)
  })
})

ipcMain.handle('update-screen-recording', async (_e, id: string, updates: object) => {
  const metaPath = join(screenRecordingsDir(), `${id}.json`)
  const existing = JSON.parse(await readFile(metaPath, 'utf-8'))
  await writeFile(metaPath, JSON.stringify({ ...existing, ...updates }))
})

ipcMain.handle('delete-screen-recording', async (_e, id: string) => {
  const dir = screenRecordingsDir()
  await Promise.all([
    ...['.webm', '.mp4', '.mov', '.mkv', '.avi'].map((ext) => unlink(join(dir, `${id}${ext}`)).catch(() => {})),
    unlink(join(dir, `${id}.json`)).catch(() => {})
  ])
})

// ── Upload file: two-step (pick → preview → prepare) ─────────────────────
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.avi'])

ipcMain.handle('pick-file', async (): Promise<
  { canceled: true } | { filePath: string; filename: string; fileExt: string; isVideo: boolean; size: number }
> => {
  const { filePaths, canceled } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Audio / Video', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm', 'mp4', 'mov', 'mkv', 'avi'] }
    ]
  })
  if (canceled || !filePaths[0]) return { canceled: true }
  const filePath = filePaths[0]
  const filename = filePath.split(/[\\/]/).pop() ?? 'upload'
  const fileExt = extname(filePath).toLowerCase()
  const isVideo = VIDEO_EXTS.has(fileExt)
  const { size } = await stat(filePath)
  return { filePath, filename, fileExt, isVideo, size }
})

ipcMain.handle('prepare-upload', async (_e, filePath: string): Promise<ArrayBuffer> => {
  const tmpPath = join(app.getPath('temp'), `mn-upload-${Date.now()}.webm`)
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, [
      '-i', filePath,
      '-vn',
      '-f', 'webm',
      '-c:a', 'libopus',
      '-y', tmpPath
    ])
    proc.stderr.on('data', () => {})
    proc.on('close', async (code) => {
      if (code === 0) {
        try {
          const buf = await readFile(tmpPath)
          await unlink(tmpPath).catch(() => {})
          resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
        } catch (err) {
          reject(err)
        }
      } else {
        await unlink(tmpPath).catch(() => {})
        reject(new Error(`ffmpeg exited with code ${code}`))
      }
    })
    proc.on('error', reject)
  })
})

// ── Import an uploaded video file into screen-recordings ───────────────────
ipcMain.handle('import-video-file', async (_e, filePath: string, meta: object): Promise<{ id: string; size: number }> => {
  const dir = screenRecordingsDir()
  await mkdir(dir, { recursive: true })
  const id = Date.now().toString()
  const fileExt = extname(filePath).toLowerCase()
  const destPath = join(dir, `${id}${fileExt}`)
  await copyFile(filePath, destPath)
  const { size } = await stat(destPath)
  await writeFile(join(dir, `${id}.json`), JSON.stringify({ ...meta, size, fileExt }))
  return { id, size }
})

// ── Docx export ────────────────────────────────────────────────────────────
ipcMain.handle('save-docx', async (_e, buffer: ArrayBuffer, filename: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [{ name: 'Word Document', extensions: ['docx'] }]
  })
  if (canceled || !filePath) return false
  await writeFile(filePath, Buffer.from(buffer))
  return true
})

ipcMain.handle('save-html', async (_e, content: string, filename: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [{ name: 'HTML Document', extensions: ['html'] }]
  })
  if (canceled || !filePath) return false
  await writeFile(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('save-pdf', async (_e, htmlContent: string, filename: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return false

  const tmpPath = join(app.getPath('temp'), `mn-print-${Date.now()}.html`)
  await writeFile(tmpPath, htmlContent, 'utf-8')

  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } })
  await win.loadFile(tmpPath)
  const pdfBuffer = await win.webContents.printToPDF({ marginsType: 1 })
  win.destroy()

  try { await unlink(tmpPath) } catch { /* ignore */ }

  await writeFile(filePath, pdfBuffer)
  return true
})

// ── Overlay window ─────────────────────────────────────────────────────────
ipcMain.on('show-overlay', () => {
  if (!overlayWindow) createOverlay()
  overlayWindow!.show()
  overlayWindow!.setAlwaysOnTop(true, 'screen-saver')
})

ipcMain.on('hide-overlay', () => {
  overlayWindow?.hide()
})

ipcMain.on('update-overlay-state', (_e, state: { duration: number; isPaused: boolean }) => {
  overlayWindow?.webContents.send('overlay-state', state)
})

// Overlay buttons → forward command to main renderer
ipcMain.on('overlay-command', (_e, command: 'pause' | 'stop') => {
  mainWindow?.webContents.send('overlay-command', command)
})

// ── AI Overlay window ──────────────────────────────────────────────────────
ipcMain.on('show-ai-overlay', () => {
  if (!aiOverlayWindow) createAiOverlay()
  aiOverlayWindow!.show()
  aiOverlayWindow!.setAlwaysOnTop(true, 'screen-saver')
})

ipcMain.on('hide-ai-overlay', () => {
  aiOverlayWindow?.hide()
})

// Renderer → AI overlay: forward events (transcript, ai_token, ai_done, status, reset)
ipcMain.on('ai-overlay-event', (_e, event: object) => {
  aiOverlayWindow?.webContents.send('ai-overlay-event', event)
})

// AI overlay buttons → forward command back to renderer
ipcMain.on('ai-overlay-command', (_e, command: 'stop' | 'close') => {
  if (command === 'close') aiOverlayWindow?.hide()
  mainWindow?.webContents.send('ai-overlay-command', command)
})

// ── Interview Banner window ────────────────────────────────────────────────
ipcMain.on('show-banner', () => {
  if (!bannerWindow) createBannerWindow()
  bannerWindow!.show()
  bannerWindow!.setAlwaysOnTop(true, 'screen-saver')
  registerBannerShortcuts()
})

ipcMain.on('hide-banner', () => {
  bannerWindow?.hide()
  unregisterBannerShortcuts()
})

// Main renderer → banner: forward state/event updates
ipcMain.on('banner-event', (_e, event: object) => {
  bannerWindow?.webContents.send('banner-event', event)
})

// Banner → main: handle or forward commands
async function bannerTakeScreenshot() {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1280, height: 720 } })
    const img = sources[0]?.thumbnail
    if (!img) return
    const dir = join(app.getPath('userData'), 'screenshots')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, `screenshot-${Date.now()}.png`), img.toPNG())
    bannerWindow?.webContents.send('banner-event', { type: 'screenshot-taken' })
  } catch (err) { console.error('[banner] screenshot:', err) }
}

async function bannerSolveScreen() {
  try {
    bannerWindow?.setContentProtection(true)
    aiOverlayWindow?.setContentProtection(true)
    await new Promise((r) => setTimeout(r, 80))
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1280, height: 720 } })
    bannerWindow?.setContentProtection(true)
    aiOverlayWindow?.setContentProtection(true)
    const img = sources[0]?.thumbnail
    if (!img) return
    const base64 = img.toDataURL().replace(/^data:image\/png;base64,/, '')
    mainWindow?.webContents.send('banner-solve-screen', base64)
  } catch (err) {
    console.error('[banner] solve-screen:', err)
    bannerWindow?.webContents.send('banner-event', { type: 'solve-error' })
  }
}

const BANNER_SHORTCUT_KEYS = [
  'CommandOrControl+Shift+Space',
  'CommandOrControl+Shift+X',
  'CommandOrControl+Shift+G',
  'CommandOrControl+Shift+S',
]

function registerBannerShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    mainWindow?.webContents.send('banner-command', 'toggle-pause')
  })
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    mainWindow?.webContents.send('banner-command', 'stop')
  })
  globalShortcut.register('CommandOrControl+Shift+G', () => {
    void bannerTakeScreenshot()
  })
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    bannerWindow?.webContents.send('banner-event', { type: 'solving' })
    void bannerSolveScreen()
  })
}

function unregisterBannerShortcuts() {
  BANNER_SHORTCUT_KEYS.forEach((key) => globalShortcut.unregister(key))
}

ipcMain.on('banner-command', (_e, command: string) => {
  if (command === 'toggle-ai-overlay') {
    if (aiOverlayWindow?.isVisible()) {
      aiOverlayWindow.hide()
    } else if (aiOverlayWindow) {
      aiOverlayWindow.show()
      aiOverlayWindow.setAlwaysOnTop(true, 'screen-saver')
    }
    return
  }

  if (command === 'screenshot') { void bannerTakeScreenshot(); return }
  if (command === 'solve-screen') { void bannerSolveScreen(); return }

  // toggle-pause / stop / prev / next → forward to main renderer
  mainWindow?.webContents.send('banner-command', command)
})

// ── Screen capture for interview banner ────────────────────────────────────
// Temporarily applies content protection so the main window (and banner inside
// it) are excluded from the desktopCapturer snapshot, then restores it.
ipcMain.handle('capture-screen', async (): Promise<string | null> => {
  mainWindow?.setContentProtection(true)
  await new Promise((r) => setTimeout(r, 80))
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1920, height: 1080 }
  })
  mainWindow?.setContentProtection(false)
  const img = sources[0]?.thumbnail
  return img ? img.toDataURL().replace(/^data:image\/png;base64,/, '') : null
})

ipcMain.handle('save-screenshot', async (_e, base64: string): Promise<string> => {
  const screenshotsDir = join(app.getPath('userData'), 'screenshots')
  await mkdir(screenshotsDir, { recursive: true })
  const filename = `screenshot-${Date.now()}.png`
  await writeFile(join(screenshotsDir, filename), Buffer.from(base64, 'base64'))
  return filename
})

// Open URL in the system default browser
ipcMain.on('open-external', (_e, url: string) => {
  shell.openExternal(url)
})

// ── Launch shortcut registration (Windows only) ────────────────────────────
ipcMain.handle('register-launch-shortcut', async (): Promise<{ success: boolean; error?: string }> => {
  if (process.platform !== 'win32') return { success: false, error: 'Only supported on Windows' }
  const exePath = app.getPath('exe')
  const lnkPath = join(
    app.getPath('appData'),
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'MeetingNote.lnk'
  )
  const ps = [
    `$ws = New-Object -ComObject WScript.Shell`,
    `$lnk = $ws.CreateShortcut('${lnkPath}')`,
    `$lnk.TargetPath = '${exePath}'`,
    `$lnk.Hotkey = 'CTRL+ALT+N'`,
    `$lnk.Description = 'Open MeetingNote'`,
    `$lnk.Save()`
  ].join('; ')
  return new Promise((resolve) => {
    const proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps])
    proc.on('close', (code) => resolve(code === 0 ? { success: true } : { success: false, error: `exit code ${code}` }))
    proc.on('error', (err) => resolve({ success: false, error: err.message }))
  })
})

ipcMain.handle('is-packaged', () => app.isPackaged)

// ── App lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  createOverlay()
  createAiOverlay()
  createBannerWindow()

  // Global shortcut: Ctrl+Alt+N → show and focus the main window from anywhere
  globalShortcut.register('CommandOrControl+Alt+N', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
