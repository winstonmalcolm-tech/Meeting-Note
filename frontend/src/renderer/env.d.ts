/// <reference types="vite/client" />

interface Window {
  api: {
    getDesktopSources: () => Promise<Array<{ id: string; name: string; thumbnail: string }>>
    saveRecording: (buffer: ArrayBuffer, meta: object) => Promise<string>
    listRecordings: () => Promise<object[]>
    readRecording: (id: string) => Promise<ArrayBuffer>
    updateRecording: (id: string, updates: object) => Promise<void>
    deleteRecording: (id: string) => Promise<void>
    saveScreenRecording: (buffer: ArrayBuffer, meta: object) => Promise<string>
    listScreenRecordings: () => Promise<object[]>
    readScreenRecording: (id: string) => Promise<ArrayBuffer>
    extractScreenAudio: (id: string) => Promise<ArrayBuffer>
    updateScreenRecording: (id: string, updates: object) => Promise<void>
    deleteScreenRecording: (id: string) => Promise<void>
    saveDocx: (buffer: ArrayBuffer, filename: string) => Promise<boolean>
    saveHtml: (content: string, filename: string) => Promise<boolean>
    savePdf: (content: string, filename: string) => Promise<boolean>
    showOverlay: () => void
    hideOverlay: () => void
    updateOverlayState: (state: { duration: number; isPaused: boolean }) => void
    onOverlayCommand: (cb: (command: 'pause' | 'stop') => void) => () => void
    showAiOverlay: () => void
    hideAiOverlay: () => void
    sendAiOverlayEvent: (event: { type: string; [key: string]: unknown }) => void
    onAiOverlayCommand: (cb: (command: 'stop' | 'close') => void) => () => void
    showBanner: () => void
    hideBanner: () => void
    sendBannerEvent: (event: { type: string; [key: string]: unknown }) => void
    onBannerCommand: (cb: (command: string) => void) => () => void
    onSolveScreenCapture: (cb: (imageBase64: string) => void) => () => void
    openExternal: (url: string) => void
    pickAndPrepareUpload: () => Promise<{ canceled: true } | { buffer: ArrayBuffer; filename: string; filePath: string }>
  }
}
