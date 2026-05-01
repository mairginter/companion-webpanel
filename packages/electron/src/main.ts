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
import { loadSettingsFile, saveSettingsFile, getSettingsPath, getDefaultSettings } from './settingsHelper'
import { loadMeta, saveMeta, normalizePath, expandPath } from './metaConfig'
import { initElectronI18n, t } from './i18n'
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

  const userDataPath = app.getPath('userData')

  // ─── Settings-Pfad auflösen (meta.json → settings.settingsPath → Backwards-Compat) ─
  const meta = loadMeta(userDataPath)
  const defaultSettingsPath = getSettingsPath(userDataPath)
  // Backwards-Compat: bestehende settings.json beim Upgrade erhalten
  const legacyPath = path.join(userDataPath, 'settings.json')

  let activeSettingsPath: string
  if (meta.settingsPath) {
    activeSettingsPath = expandPath(meta.settingsPath)
  } else if (fs.existsSync(legacyPath)) {
    activeSettingsPath = legacyPath
  } else {
    activeSettingsPath = defaultSettingsPath
  }

  let settings = loadSettingsFile(activeSettingsPath)

  // Settings-Vorrang: wenn settings.settingsPath auf anderen Pfad zeigt → redirect
  if (settings.settingsPath) {
    const fromSettings = expandPath(settings.settingsPath)
    if (fromSettings !== activeSettingsPath) {
      activeSettingsPath = fromSettings
      settings = loadSettingsFile(activeSettingsPath)
      saveMeta(userDataPath, { settingsPath: normalizePath(activeSettingsPath) })
    }
  }

  // Initialise Electron i18n with the language from settings (fallback: 'de')
  await initElectronI18n(settings.language ?? 'de')

  const settingsPath = activeSettingsPath
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

  // ─── Startup-Fenster (sofort anzeigen) ────────────────────────────────────

  const startupWindow = new StartupWindow()
  startupWindow.create()

  const panelWindow = new PanelWindow()

  // Cache + Service Worker im Hintergrund löschen (fire-and-forget) — vorher
  // blockierte das den Startup um ~300 ms. Frontend wird mit frischem Cache
  // geladen sobald Backend-Port live ist; der Timer kommt sowieso danach.
  session.defaultSession.clearCache().catch((err) => {
    console.warn('[Electron] clearCache fehlgeschlagen:', err)
  })
  session.defaultSession.clearStorageData({
    storages: ['cachestorage', 'serviceworkers'],
  }).catch((err) => {
    console.warn('[Electron] clearStorageData fehlgeschlagen:', err)
  })

  // ─── Backend starten (asynchron, nicht blockierend) ───────────────────────

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

  // Backend-Start ohne await — Startup-Fenster + Tray sollen sofort da sein.
  // Sobald Backend läuft wird ein Status-Update geschickt.
  if (actualPort !== null) {
    createBackend(settings, actualPort, settingsPath, onHostStatus, staticDir)
      .then((instance) => {
        backendInstance = instance
        startupWindow.sendStatusUpdate(appStatus)
      })
      .catch((err) => {
        console.error('[Electron] Backend-Start fehlgeschlagen:', err)
      })
  }

  // ─── Tray ──────────────────────────────────────────────────────────────────

  // Quit mit Bestätigungs-Dialog
  async function askQuit(): Promise<void> {
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: [t('dialog.quitConfirm'), t('dialog.cancel')],
      defaultId: 0,
      cancelId: 1,
      title: 'Companion Webpanel',
      message: t('dialog.quitMessage'),
      detail: t('dialog.quitDetail'),
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

  ipcMain.handle('get-i18n-strings', () => ({
    panelRunsOn:          t('startup.panelRunsOn'),
    noPortAvailable:      t('startup.noPortAvailable'),
    waitingForConnection: t('startup.waitingForConnection'),
    noHostsConfigured:    t('startup.noHostsConfigured'),
    openInApp:            t('startup.openInApp'),
    openInBrowser:        t('startup.openInBrowser'),
    hide:                 t('startup.hide'),
    quit:                 t('startup.quit'),
    apply:                t('startup.apply'),
    loadPreferenceFile:   t('startup.loadPreferenceFile'),
    preferenceFile:       t('startup.preferenceFile'),
    newConfig:            t('startup.newConfig'),
  }))

  // Fix #4: Fenster beim Open Panel nicht schließen
  ipcMain.handle('open-settings-folder', () => {
    shell.openPath(userDataPath)
  })

  ipcMain.handle('get-settings-path', () => normalizePath(activeSettingsPath))

  ipcMain.handle('choose-settings-path', async () => {
    const result = await dialog.showOpenDialog({
      defaultPath: path.dirname(activeSettingsPath),
      filters: [{ name: 'JSON Settings', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return normalizePath(result.filePaths[0])
  })

  ipcMain.handle('apply-settings-path', async (_event, normalizedNewPath: string) => {
    const newAbsPath = expandPath(normalizedNewPath)
    // Aktuellen Settings-Inhalt in neue Datei kopieren wenn dort noch nicht vorhanden
    if (!fs.existsSync(newAbsPath)) {
      saveSettingsFile(newAbsPath, settings)
    }
    // settingsPath-Feld in aktuelle Settings-Datei schreiben
    settings.settingsPath = normalizedNewPath
    saveSettingsFile(activeSettingsPath, settings)
    // meta.json auf neuen Pfad setzen
    saveMeta(userDataPath, { settingsPath: normalizedNewPath })
    // App neu starten — app.exit() statt app.quit() damit der close-Handler
    // des Startup-Fensters (e.preventDefault) den Quit nicht blockiert
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle('new-settings-file', async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(path.dirname(activeSettingsPath), 'companionwebpanel.json'),
      filters: [{ name: 'JSON Settings', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return null
    const newAbsPath = result.filePath
    saveSettingsFile(newAbsPath, getDefaultSettings())
    saveMeta(userDataPath, { settingsPath: normalizePath(newAbsPath) })
    app.relaunch()
    app.exit(0)
    return normalizePath(newAbsPath)
  })

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
    saveSettingsFile(activeSettingsPath, settings)

    // Backend neu starten mit neuem Port (staticDir beibehalten).
    // Fehler beim Stop protokollieren, aber nicht propagieren — sonst bleibt der
    // Renderer in einem hängenden Promise und altes Backend läuft evtl. weiter.
    if (backendInstance) {
      try {
        await backendInstance.stop()
      } catch (err) {
        console.error('[Electron] Backend-Stop fehlgeschlagen:', err)
      }
      backendInstance = null
    }
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
