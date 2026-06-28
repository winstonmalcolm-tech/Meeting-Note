import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('bannerApi', {
  onEvent: (cb: (event: { type: string; [key: string]: unknown }) => void) => {
    ipcRenderer.on('banner-event', (_e, event) => cb(event))
  },
  sendCommand: (command: string) => {
    ipcRenderer.send('banner-command', command)
  }
})
