import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Desktop sources (screens + windows with thumbnails)
  getDesktopSources: (): Promise<Array<{ id: string; name: string; thumbnail: string }>> =>
    ipcRenderer.invoke('get-desktop-sources'),

  // Audio recordings
  saveRecording: (buffer: ArrayBuffer, meta: object): Promise<string> =>
    ipcRenderer.invoke('save-recording', buffer, meta),

  listRecordings: (): Promise<object[]> =>
    ipcRenderer.invoke('list-recordings'),

  readRecording: (id: string): Promise<ArrayBuffer> =>
    ipcRenderer.invoke('read-recording', id),

  updateRecording: (id: string, updates: object): Promise<void> =>
    ipcRenderer.invoke('update-recording', id, updates),

  deleteRecording: (id: string): Promise<void> =>
    ipcRenderer.invoke('delete-recording', id),

  // Screen recordings
  saveScreenRecording: (buffer: ArrayBuffer, meta: object): Promise<string> =>
    ipcRenderer.invoke('save-screen-recording', buffer, meta),

  listScreenRecordings: (): Promise<object[]> =>
    ipcRenderer.invoke('list-screen-recordings'),

  readScreenRecording: (id: string): Promise<ArrayBuffer> =>
    ipcRenderer.invoke('read-screen-recording', id),

  extractScreenAudio: (id: string): Promise<ArrayBuffer> =>
    ipcRenderer.invoke('extract-screen-audio', id),

  updateScreenRecording: (id: string, updates: object): Promise<void> =>
    ipcRenderer.invoke('update-screen-recording', id, updates),

  deleteScreenRecording: (id: string): Promise<void> =>
    ipcRenderer.invoke('delete-screen-recording', id),

  // Docx export
  saveDocx: (buffer: ArrayBuffer, filename: string): Promise<boolean> =>
    ipcRenderer.invoke('save-docx', buffer, filename),

  // HTML export
  saveHtml: (content: string, filename: string): Promise<boolean> =>
    ipcRenderer.invoke('save-html', content, filename),

  // PDF export
  savePdf: (content: string, filename: string): Promise<boolean> =>
    ipcRenderer.invoke('save-pdf', content, filename),

  // Overlay control
  showOverlay: (): void => ipcRenderer.send('show-overlay'),
  hideOverlay: (): void => ipcRenderer.send('hide-overlay'),
  updateOverlayState: (state: { duration: number; isPaused: boolean }): void =>
    ipcRenderer.send('update-overlay-state', state),
  onOverlayCommand: (cb: (command: 'pause' | 'stop') => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, cmd: 'pause' | 'stop'): void => cb(cmd)
    ipcRenderer.on('overlay-command', handler)
    return () => ipcRenderer.removeListener('overlay-command', handler)
  },

  // AI overlay control
  showAiOverlay: (): void => ipcRenderer.send('show-ai-overlay'),
  hideAiOverlay: (): void => ipcRenderer.send('hide-ai-overlay'),
  sendAiOverlayEvent: (event: { type: string; [key: string]: unknown }): void =>
    ipcRenderer.send('ai-overlay-event', event),
  onAiOverlayCommand: (cb: (command: 'stop' | 'close') => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, cmd: 'stop' | 'close'): void => cb(cmd)
    ipcRenderer.on('ai-overlay-command', handler)
    return () => ipcRenderer.removeListener('ai-overlay-command', handler)
  },

  // Interview banner control
  showBanner: (): void => ipcRenderer.send('show-banner'),
  hideBanner: (): void => ipcRenderer.send('hide-banner'),
  sendBannerEvent: (event: { type: string; [key: string]: unknown }): void =>
    ipcRenderer.send('banner-event', event),
  onBannerCommand: (cb: (command: string) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, cmd: string): void => cb(cmd)
    ipcRenderer.on('banner-command', handler)
    return () => ipcRenderer.removeListener('banner-command', handler)
  },
  onSolveScreenCapture: (cb: (imageBase64: string) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, base64: string): void => cb(base64)
    ipcRenderer.on('banner-solve-screen', handler)
    return () => ipcRenderer.removeListener('banner-solve-screen', handler)
  },

  openExternal: (url: string): void => ipcRenderer.send('open-external', url),

  registerLaunchShortcut: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('register-launch-shortcut'),

  isPackaged: (): Promise<boolean> =>
    ipcRenderer.invoke('is-packaged'),

  pickFile: (): Promise<{ canceled: true } | { filePath: string; filename: string; fileExt: string; isVideo: boolean; size: number }> =>
    ipcRenderer.invoke('pick-file'),

  prepareUpload: (filePath: string): Promise<ArrayBuffer> =>
    ipcRenderer.invoke('prepare-upload', filePath),

  importVideoFile: (filePath: string, meta: object): Promise<{ id: string; size: number }> =>
    ipcRenderer.invoke('import-video-file', filePath, meta)
})
