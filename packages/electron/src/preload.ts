/**
 * preload.ts — Electron Preload Script
 *
 * Stellt window.cwpApi im Startup-Renderer bereit (contextBridge).
 * Läuft in einem isolierten Kontext — kein direkter Node.js-Zugriff aus dem Renderer.
 *
 * Exposes:
 *   getStatus()          → AppStatus (einmalig beim Laden)
 *   onStatusUpdate(cb)   → registriert einen Listener für Push-Updates
 *   changePort(port)     → fordert Port-Änderung + Neustart an
 *   openPanel()          → öffnet localhost:<port> im Default-Browser
 *   getVersion()         → App-Version aus package.json (z.B. "1.2.3")
 *   quit()               → graceful shutdown
 */
import { contextBridge, ipcRenderer } from 'electron'
import type { AppStatus } from './types'

contextBridge.exposeInMainWorld('cwpApi', {
  getStatus: (): Promise<AppStatus> =>
    ipcRenderer.invoke('get-status'),

  onStatusUpdate: (cb: (status: AppStatus) => void): void => {
    ipcRenderer.on('status-update', (_event, status: AppStatus) => cb(status))
  },

  changePort: (port: number): Promise<void> =>
    ipcRenderer.invoke('change-port', port),

  openPanel: (): Promise<void> =>
    ipcRenderer.invoke('open-panel'),

  openPanelApp: (): Promise<void> =>
    ipcRenderer.invoke('open-panel-app'),

  getVersion: (): Promise<string> =>
    ipcRenderer.invoke('get-version'),

  quit: (): void => {
    ipcRenderer.send('quit')
  },

  hideWindow: (): void => {
    ipcRenderer.send('hide-window')
  },
})
