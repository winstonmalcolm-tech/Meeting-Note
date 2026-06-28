import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('overlayApi', {
  onState: (cb: (data: { duration: number; isPaused: boolean }) => void) => {
    ipcRenderer.on('overlay-state', (_e, data) => cb(data))
  },
  sendCommand: (command: 'pause' | 'stop') => ipcRenderer.send('overlay-command', command)
})
