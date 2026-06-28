import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('aiOverlayApi', {
  onEvent: (cb: (event: { type: string; [key: string]: unknown }) => void) => {
    ipcRenderer.on('ai-overlay-event', (_e, event) => cb(event))
  },
  sendCommand: (command: 'stop' | 'close') => ipcRenderer.send('ai-overlay-command', command)
})
