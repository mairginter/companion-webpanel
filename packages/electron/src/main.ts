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
import { app, ipcMain, shell, dialog, session, clipboard } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { createBackend, getLanAddresses } from '@cwp/backend'
import { loadSettingsFile, saveSettingsFile, getSettingsPath, getDefaultSettings } from './settingsHelper'
import { loadMeta, saveMeta, normalizePath, expandPath } from './metaConfig'
import { initElectronI18n, t, ELECTRON_LANGUAGES, DEFAULT_LANGUAGE } from './i18n'
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
  // meta.json: rechner-lokale Daten (Settings-Pfad, Sprache des Startfensters)
  let meta = loadMeta(userDataPath)
  // Schreibt einzelne Felder in meta.json, ohne die übrigen zu verlieren
  const updateMeta = (patch: Partial<typeof meta>): void => {
    meta = { ...meta, ...patch }
    saveMeta(userDataPath, meta)
  }
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

  // Datei fehlt (erster Start, verschoben oder gelöscht)?
  // KEIN Auto-Create — User wählt im Startup-Fenster eine Datei oder erstellt eine neue.
  const configMissing = !fs.existsSync(activeSettingsPath)

  let settings = configMissing
    ? getDefaultSettings()
    : loadSettingsFile(activeSettingsPath)

  // Backwards-Compat: settings.settingsPath — Pointer auf anderen Pfad folgen.
  // Nur wenn Zieldatei tatsächlich existiert (kein Auto-Create).
  if (!configMissing && settings.settingsPath) {
    const fromSettings = expandPath(settings.settingsPath)
    if (fromSettings !== activeSettingsPath && fs.existsSync(fromSettings)) {
      activeSettingsPath = fromSettings
      settings = loadSettingsFile(activeSettingsPath)
      updateMeta({ settingsPath: normalizePath(activeSettingsPath) })
    }
  }

  // Sprache von Startfenster + Tray:
  //   1. im Startfenster gewählt (meta.json, rechner-lokal)
  //   2. globale Vorgabe Settings.language
  //   3. Default Englisch
  let uiLanguage = meta.language ?? settings.language ?? DEFAULT_LANGUAGE
  await initElectronI18n(uiLanguage)

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
    configMissing: configMissing || undefined,
    language: uiLanguage,
    // Netzwerk-Adressen für die Zeile "Netzwerk:" im Startfenster (Tablet/zweiter PC)
    lanAddresses: getLanAddresses(),
    hosts: configMissing
      ? []
      : settings.hosts
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
  // Bei fehlendem Config-File kein Backend starten — User muss erst Datei wählen.
  if (actualPort !== null && !configMissing) {
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

  /**
   * Adresse des Panels auf diesem Rechner. Wurde die Sprache im Startfenster ausdrücklich
   * gewählt, wird sie als ?lang= mitgegeben — das Panel übernimmt sie dann als Geräte-Wahl,
   * Startfenster und Panel sprechen dieselbe Sprache. Ohne Wahl bleibt die Adresse neutral.
   */
  const panelUrl = (extra: Record<string, string> = {}): string => {
    const params = new URLSearchParams(extra)
    if (meta.language) params.set('lang', meta.language)
    const query = params.toString()
    return `http://localhost:${appStatus.port}/${query ? `?${query}` : ''}`
  }

  const tray = new AppTray(
    () => panelWindow.open(panelUrl()),
    () => shell.openExternal(panelUrl()),
    () => startupWindow.show(),
    () => askQuit(),
  )
  tray.create()
  tray.updateStatus(appStatus)
  startupWindow.sendStatusUpdate(appStatus)

  // ─── IPC-Handler ───────────────────────────────────────────────────────────

  ipcMain.handle('get-status', () => appStatus)
  ipcMain.handle('get-version', () => app.getVersion())

  // Sprache des Startfensters wechseln: rechner-lokal merken, Tray-Menü neu aufbauen.
  // Der Renderer holt sich danach die Strings neu (get-i18n-strings).
  ipcMain.handle('set-language', async (_event, lang: string) => {
    if (!ELECTRON_LANGUAGES.includes(lang)) return uiLanguage
    uiLanguage = lang
    updateMeta({ language: lang })
    await initElectronI18n(lang)
    appStatus.language = lang
    tray.updateStatus(appStatus)
    return uiLanguage
  })

  // Text in die Zwischenablage (Netzwerk-Adresse im Startfenster)
  ipcMain.handle('copy-text', (_event, text: string) => {
    clipboard.writeText(String(text ?? ''))
    return true
  })

  // Panel im App-Fenster öffnen und dort direkt den Geräte-Links-Dialog zeigen
  ipcMain.handle('open-device-links', () => {
    panelWindow.open(panelUrl({ links: '1' }))
  })

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
    newConfigDesc:        t('startup.newConfigDesc'),
    configFile:           t('startup.configFile'),
    configMissing:        t('startup.configMissing'),
    downloadHelp:         t('startup.downloadHelp'),
    downloadHelpDesc:     t('startup.downloadHelpDesc'),
    network:              t('startup.network'),
    noNetwork:            t('startup.noNetwork'),
    copyAddress:          t('startup.copyAddress'),
    copied:               t('startup.copied'),
    deviceLinks:          t('startup.deviceLinks'),
    deviceLinksDesc:      t('startup.deviceLinksDesc'),
    switchLanguage:       t('startup.switchLanguage'),
    portTitle:            t('startup.portTitle'),
  }))

  // Hilfe-Download: kopiert help-me-KI-by_alex.md aus dem gebauten Frontend
  // (Vite übernimmt public/ 1:1 nach dist/) an einen vom User gewählten Ort.
  // Rückgabe: true = gespeichert, false = abgebrochen / Datei nicht vorhanden.
  ipcMain.handle('download-help', async () => {
    const helpFile = 'help-me-KI-by_alex.md'
    const src = path.join(frontendDir, helpFile)
    if (!fs.existsSync(src)) {
      console.warn('[Electron] Hilfedatei nicht gefunden:', src)
      return false
    }
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('downloads'), helpFile),
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (result.canceled || !result.filePath) return false
    await fs.promises.copyFile(src, result.filePath)
    shell.showItemInFolder(result.filePath)
    return true
  })

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
    // Nur meta.json aktualisieren — keine Dateien anlegen oder überschreiben.
    // showOpenDialog liefert nur existierende Dateien, daher kein Copy nötig.
    updateMeta({ settingsPath: normalizedNewPath })
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
    updateMeta({ settingsPath: normalizePath(newAbsPath) })
    app.relaunch()
    app.exit(0)
    return normalizePath(newAbsPath)
  })

  ipcMain.handle('open-panel', () => {
    shell.openExternal(panelUrl())
  })

  ipcMain.handle('open-panel-app', () => {
    panelWindow.open(panelUrl())
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
