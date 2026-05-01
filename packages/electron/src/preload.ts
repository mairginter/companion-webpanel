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
 *   openSettingsFolder() → öffnet AppData/CompanionWebpanel im Datei-Explorer
 *   openPanel()          → öffnet localhost:<port> im Default-Browser
 *   getVersion()         → App-Version aus package.json (z.B. "1.2.3")
 *   getI18nStrings()     → übersetzte UI-Strings für startup.html
 *   quit()               → graceful shutdown
 *   getSettingsPath()        → current settings file path (~-normalized)
 *   chooseSettingsPath()     → opens file picker, returns chosen path or null
 *   applySettingsPath(path)  → saves new path + relaunches app
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

  openSettingsFolder: (): Promise<void> =>
    ipcRenderer.invoke('open-settings-folder'),

  openPanel: (): Promise<void> =>
    ipcRenderer.invoke('open-panel'),

  openPanelApp: (): Promise<void> =>
    ipcRenderer.invoke('open-panel-app'),

  getVersion: (): Promise<string> =>
    ipcRenderer.invoke('get-version'),

  getI18nStrings: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke('get-i18n-strings'),

  quit: (): void => {
    ipcRenderer.send('quit')
  },

  hideWindow: (): void => {
    ipcRenderer.send('hide-window')
  },

  getSettingsPath: (): Promise<string> =>
    ipcRenderer.invoke('get-settings-path'),

  chooseSettingsPath: (): Promise<string | null> =>
    ipcRenderer.invoke('choose-settings-path'),

  applySettingsPath: (settingsPath: string): Promise<void> =>
    ipcRenderer.invoke('apply-settings-path', settingsPath),

  newSettingsFile: (): Promise<string | null> =>
    ipcRenderer.invoke('new-settings-file'),
})
