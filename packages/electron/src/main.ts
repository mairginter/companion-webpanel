/**
 * main.ts — Electron Entry Point
 *
 * Boot-Sequenz:
 *  1. app.whenReady()
 *  2. Settings laden (aus userData)
 *  3. Freien Port ermitteln (portCheck)
 *  4. Startup-Fenster anzeigen
 *  5. Backend starten (createBackend aus @cwp/backend)
 *  6. Tray anlegen
 *  7. IPC-Handler registrieren
 *  8. app.on('window-all-closed') → nicht beenden (Tray-App)
 */
import { app, ipcMain, shell, dialog, session } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { createBackend } from '@cwp/backend'
import { loadSettings, saveSettings, getSettingsPath } from './settingsHelper'
import { findFreePort } from './portCheck'
import { StartupWindow } from './startupWindow'
import { AppTray } from './tray'
import { PanelWindow } from './panelWindow'
import type { AppStatus } from './types'

// App-Name + userData-Pfad explizit setzen — auch bei Portable-Build bleibt %APPDATA%\CompanionWebpanel
app.setName('CompanionWebpanel')
app.setPath('userData', path.join(app.getPath('appData'), 'CompanionWebpanel'))

// Verhindert mehrere App-Instanzen
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

async function main(): Promise<void> {
  await app.whenReady()

  // Cache + Service Worker beim Start löschen → immer aktueller Frontend-Stand
  await session.defaultSession.clearCache()
  await session.defaultSession.clearStorageData({
    storages: ['cachestorage', 'serviceworkers'],
  })

  const userDataPath = app.getPath('userData')
  const settings = loadSettings(userDataPath)
  const settingsPath = getSettingsPath(userDataPath)
  const configuredPort = settings.server?.port ?? 8080

  // ─── Port-Check ────────────────────────────────────────────────────────────

  const actualPort = await findFreePort(configuredPort)
  const portAuto = actualPort !== null && actualPort !== configuredPort

  // ─── Status-State ──────────────────────────────────────────────────────────

  // Fix #5: nur Hosts anzeigen die showInToolbar !== false UND autoConnect !== false haben
  const appStatus: AppStatus = {
    port: actualPort ?? 0,
    portAuto,
    hosts: settings.hosts
      .filter((h) => h.showInToolbar !== false && h.autoConnect !== false)
      .map((h) => ({
        id: h.id,
        name: h.name,
        status: 'connecting',
      })),
  }

  // ─── Startup-Fenster ───────────────────────────────────────────────────────

  const startupWindow = new StartupWindow()
  startupWindow.create()

  const panelWindow = new PanelWindow()

  // ─── Backend starten ───────────────────────────────────────────────────────

  let backendInstance: { stop: () => Promise<void> } | null = null

  // Frontend-Static-Dir: gebautes Frontend in packages/electron/frontend/
  // Wird sowohl im packaged Build als auch nach electron:dev (build:electron) genutzt.
  const frontendDir = path.join(app.getAppPath(), 'frontend')
  const staticDir = fs.existsSync(frontendDir) ? frontendDir : undefined

  // Status-Callback: wird bei createBackend (Boot + Port-Wechsel) verwendet
  const onHostStatus = (hostId: string, status: string) => {
    const host = appStatus.hosts.find((h) => h.id === hostId)
    if (host) {
      host.status = status as AppStatus['hosts'][0]['status']
      startupWindow.sendStatusUpdate(appStatus)
      tray.updateStatus(appStatus)
    }
  }

  if (actualPort !== null) {
    backendInstance = await createBackend(settings, actualPort, settingsPath, onHostStatus, staticDir)
  }

  // ─── Tray ──────────────────────────────────────────────────────────────────

  // Quit mit Bestätigungs-Dialog
  async function askQuit(): Promise<void> {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Beenden', 'Abbrechen'],
      defaultId: 0,
      cancelId: 1,
      title: 'Companion Webpanel',
      message: 'Companion Webpanel beenden?',
      detail: 'Das Panel ist dann nicht mehr erreichbar.',
    })
    if (response === 0) shutdown()
  }

  const tray = new AppTray(
    () => panelWindow.open(`http://localhost:${appStatus.port}`),
    () => shell.openExternal(`http://localhost:${appStatus.port}`),
    () => startupWindow.show(),
    () => askQuit(),
  )
  tray.create()
  tray.updateStatus(appStatus)
  startupWindow.sendStatusUpdate(appStatus)

  // ─── IPC-Handler ───────────────────────────────────────────────────────────

  ipcMain.handle('get-status', () => appStatus)
  ipcMain.handle('get-version', () => app.getVersion())

  // Fix #4: Fenster beim Open Panel nicht schließen
  ipcMain.handle('open-panel', () => {
    shell.openExternal(`http://localhost:${appStatus.port}`)
  })

  ipcMain.handle('open-panel-app', () => {
    panelWindow.open(`http://localhost:${appStatus.port}`)
  })

  ipcMain.on('hide-window', () => startupWindow.hide())

  ipcMain.handle('change-port', async (_event, newPort: number) => {
    // Settings updaten
    settings.server = { port: newPort }
    saveSettings(userDataPath, settings)

    // Backend neu starten mit neuem Port (staticDir beibehalten)
    if (backendInstance) await backendInstance.stop()
    backendInstance = await createBackend(settings, newPort, settingsPath, onHostStatus, staticDir)
    appStatus.port = newPort
    appStatus.portAuto = false
    startupWindow.sendStatusUpdate(appStatus)
    tray.updateStatus(appStatus)
  })

  ipcMain.on('quit', () => askQuit())

  // ─── App-Lifecycle ─────────────────────────────────────────────────────────

  // Tray-App: nicht beenden wenn alle Fenster geschlossen
  // (window-all-closed ohne Handler → App beendet sich automatisch; Handler = bewusst leer lassen)
  app.on('window-all-closed', () => { /* absichtlich leer — Tray-App bleibt aktiv */ })

  // macOS: Klick auf Dock-Icon → Fenster zeigen
  app.on('activate', () => startupWindow.show())

  // Zweite Instanz → Fenster fokussieren
  app.on('second-instance', () => startupWindow.show())

  // ─── Graceful Shutdown ─────────────────────────────────────────────────────

  let shuttingDown = false

  async function shutdown(): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true

    startupWindow.destroy()
    panelWindow.destroy()
    tray.destroy()

    try {
      await backendInstance?.stop()
    } catch (err) {
      console.error('[Electron] Fehler beim Backend-Stop:', err)
    }

    app.exit(0)
  }

  // process.on('exit') als Fallback für Windows (SIGTERM kommt nicht immer an)
  process.on('exit', () => {
    if (!shuttingDown) backendInstance?.stop().catch(() => {})
  })
}

main().catch((err) => {
  console.error('[Electron] Unbehandelter Fehler:', err)
  app.exit(1)
})
