/**
 * tray.ts — System-Tray Management
 *
 * Erstellt ein Tray-Icon mit Kontextmenü.
 * Icon wechselt je nach Host-Verbindungsstatus:
 *   Alle connected  → tray-connected.png (grün)
 *   Mind. 1 error   → tray-partial.png   (orange)
 *   Alle error      → tray-error.png     (rot)
 *
 * Menü-Einträge: Open Panel, Open Settings, [Host-Status-Liste], Show Window, Quit.
 */
import { Tray, Menu, shell, nativeImage } from 'electron'
import * as path from 'path'
import type { AppStatus, HostStatus } from './types'

export class AppTray {
  private tray: Tray | null = null
  private currentStatus: AppStatus = { port: 8080, portAuto: false, hosts: [] }
  private onOpenApp: () => void
  private onOpenBrowser: () => void
  private onShowWindow: () => void
  private onQuit: () => void
  private assetsPath: string

  constructor(
    onOpenApp: () => void,
    onOpenBrowser: () => void,
    onShowWindow: () => void,
    onQuit: () => void,
  ) {
    this.onOpenApp = onOpenApp
    this.onOpenBrowser = onOpenBrowser
    this.onShowWindow = onShowWindow
    this.onQuit = onQuit
    this.assetsPath = path.join(__dirname, '..', 'assets')
  }

  /** Erstellt das Tray-Icon. Muss nach app.whenReady() aufgerufen werden. */
  create(): void {
    const icon = this.getIcon(this.currentStatus)
    this.tray = new Tray(icon)
    this.tray.setToolTip('Companion Webpanel')
    this.rebuildMenu()

    // Doppelklick auf Tray-Icon → Fenster zeigen (Windows/Linux)
    this.tray.on('double-click', () => this.onShowWindow())
  }

  /** Aktualisiert Status und baut Menü neu. */
  updateStatus(status: AppStatus): void {
    this.currentStatus = status
    if (this.tray) {
      this.tray.setImage(this.getIcon(status))
      this.rebuildMenu()
    }
  }

  /** Zerstört das Tray-Icon. */
  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private rebuildMenu(): void {
    const { port, hosts } = this.currentStatus

    const hostItems = hosts.length > 0
      ? hosts.map((h) => ({
          label: `${this.statusIcon(h.status)} ${h.name || h.id}`,
          enabled: false,
        }))
      : [{ label: 'Keine Hosts konfiguriert', enabled: false }]

    const menu = Menu.buildFromTemplate([
      {
        label: 'Open in App',
        click: () => this.onOpenApp(),
      },
      {
        label: 'Open in Browser',
        click: () => this.onOpenBrowser(),
      },
      { type: 'separator' },
      ...hostItems,
      { type: 'separator' },
      {
        label: 'Show Window',
        click: () => this.onShowWindow(),
      },
      {
        label: 'Quit',
        click: () => this.onQuit(),
      },
    ])

    this.tray?.setContextMenu(menu)
  }

  private getIcon(status: AppStatus): Electron.NativeImage {
    const allConnected = status.hosts.length > 0 &&
      status.hosts.every((h) => h.status === 'connected')
    const allError = status.hosts.length === 0 ||
      status.hosts.every((h) => h.status === 'error')

    let iconFile: string
    if (allConnected) {
      iconFile = 'tray-connected.png'
    } else if (allError) {
      iconFile = 'tray-error.png'
    } else {
      iconFile = 'tray-partial.png'
    }

    const iconPath = path.join(this.assetsPath, iconFile)
    // Fallback auf leeres Icon wenn Datei nicht existiert (z.B. in Dev ohne Assets)
    try {
      return nativeImage.createFromPath(iconPath)
    } catch {
      return nativeImage.createEmpty()
    }
  }

  private statusIcon(status: HostStatus['status']): string {
    switch (status) {
      case 'connected':      return '●'
      case 'connecting':     return '◌'
      case 'stale':          return '◑'
      case 'error':          return '○'
      case 'caps-disabled':  return '⊘'
    }
  }
}
