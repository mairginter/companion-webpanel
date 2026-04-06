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
import { app, ipcMain, shell } from 'electron'
import * as path from 'path'
import { createBackend } from '@cwp/backend'
import { loadSettings, saveSettings, getSettingsPath } from './settingsHelper'
import { findFreePort } from './portCheck'
import { StartupWindow } from './startupWindow'
import { AppTray } from './tray'
import type { AppStatus } from './types'

// Verhindert mehrere App-Instanzen
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

async function main(): Promise<void> {
  await app.whenReady()

  const userDataPath = app.getPath('userData')
  const settings = loadSettings(userDataPath)
  const settingsPath = getSettingsPath(userDataPath)
  const configuredPort = settings.server?.port ?? 8080

  // ─── Port-Check ────────────────────────────────────────────────────────────

  const actualPort = await findFreePort(configuredPort)
  const portAuto = actualPort !== null && actualPort !== configuredPort

  // ─── Status-State ──────────────────────────────────────────────────────────

  const appStatus: AppStatus = {
    port: actualPort ?? 0,
    portAuto,
    hosts: settings.hosts.map((h) => ({
      id: h.id,
      name: h.name,
      status: 'connecting',
    })),
  }

  // ─── Startup-Fenster ───────────────────────────────────────────────────────

  const startupWindow = new StartupWindow()
  startupWindow.create()

  // ─── Backend starten ───────────────────────────────────────────────────────

  let backendInstance: { stop: () => Promise<void> } | null = null

  // Frontend-Static-Dir: im pakettierten Build liegt es neben dist/
  // In dev (npm run dev) ist staticDir undefined → Vite serviert auf :5173
  const staticDir = app.isPackaged
    ? path.join(app.getAppPath(), 'frontend')
    : undefined

  if (actualPort !== null) {
    backendInstance = await createBackend(
      settings,
      actualPort,
      settingsPath,
      (hostId, status) => {
        // Host-Status im appStatus aktualisieren
        const host = appStatus.hosts.find((h) => h.id === hostId)
        if (host) {
          host.status = status as AppStatus['hosts'][0]['status']
          startupWindow.sendStatusUpdate({ ...appStatus })
          tray.updateStatus({ ...appStatus })
        }
      },
      staticDir,
    )
  }

  // ─── Tray ──────────────────────────────────────────────────────────────────

  const tray = new AppTray(
    () => startupWindow.show(),
    () => shutdown(),
  )
  tray.create()
  tray.updateStatus(appStatus)
  startupWindow.sendStatusUpdate(appStatus)

  // ─── IPC-Handler ───────────────────────────────────────────────────────────

  ipcMain.handle('get-status', () => appStatus)

  ipcMain.handle('open-panel', () => {
    shell.openExternal(`http://localhost:${appStatus.port}`)
    startupWindow.hide()
  })

  ipcMain.handle('change-port', async (_event, newPort: number) => {
    // Settings updaten
    settings.server = { port: newPort }
    saveSettings(userDataPath, settings)

    // Backend neu starten mit neuem Port
    if (backendInstance) await backendInstance.stop()
    backendInstance = await createBackend(
      settings,
      newPort,
      settingsPath,
      (hostId, status) => {
        const host = appStatus.hosts.find((h) => h.id === hostId)
        if (host) {
          host.status = status as AppStatus['hosts'][0]['status']
          startupWindow.sendStatusUpdate({ ...appStatus })
          tray.updateStatus({ ...appStatus })
        }
      },
    )
    appStatus.port = newPort
    appStatus.portAuto = false
    startupWindow.sendStatusUpdate({ ...appStatus })
    tray.updateStatus({ ...appStatus })
  })

  ipcMain.on('quit', () => shutdown())

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
