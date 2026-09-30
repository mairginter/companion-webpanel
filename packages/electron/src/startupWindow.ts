/**
 * startupWindow.ts — Startup-Fenster Management
 *
 * Kleines Fenster (400×350px) das beim Start erscheint, Port + Host-Status zeigt,
 * und sich versteckt wenn der User "Open Panel" klickt oder das Fenster schließt.
 * Kann über show() wieder eingeblendet werden (z.B. aus dem Tray-Menü).
 */
import { BrowserWindow } from 'electron'
import * as path from 'path'
import type { AppStatus } from './types'

export class StartupWindow {
  private win: BrowserWindow | null = null
  private preloadPath: string
  private htmlPath: string
  private iconPath: string

  constructor() {
    // Pfade relativ zur kompilierten dist/main.js
    this.preloadPath = path.join(__dirname, 'preload.js')
    this.htmlPath = path.join(__dirname, '..', 'renderer', 'startup.html')
    this.iconPath = path.join(__dirname, '..', 'assets', 'icon-256.png')
  }

  /** Erstellt und zeigt das Startup-Fenster. */
  create(): void {
    if (this.win) {
      this.win.show()
      this.win.focus()
      return
    }

    this.win = new BrowserWindow({
      width: 400,
      height: 365,  // +15 px für den "Hilfe herunterladen"-Link unter der Version
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      titleBarStyle: 'hidden',
      backgroundColor: '#0f141a',
      icon: this.iconPath,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    this.win.loadFile(this.htmlPath)

    // Fenster schließen → nur verstecken, nicht beenden
    this.win.on('close', (e) => {
      e.preventDefault()
      this.win?.hide()
    })

    // Aufräumen wenn Fenster zerstört wird (z.B. beim App-Quit)
    this.win.on('closed', () => {
      this.win = null
    })
  }

  /** Zeigt das Fenster (falls versteckt). */
  show(): void {
    if (this.win) {
      this.win.show()
      this.win.focus()
    } else {
      this.create()
    }
  }

  /** Versteckt das Fenster (nicht zerstören). */
  hide(): void {
    this.win?.hide()
  }

  /**
   * Sendet einen Status-Update an den Renderer.
   * Wird aufgerufen wenn sich Port oder Host-Status ändert.
   */
  sendStatusUpdate(status: AppStatus): void {
    if (this.win?.webContents && !this.win.webContents.isDestroyed()) {
      this.win.webContents.send('status-update', status)
    }
  }

  /** Zerstört das Fenster (nur beim echten App-Quit). */
  destroy(): void {
    if (this.win) {
      this.win.removeAllListeners('close')
      this.win.destroy()
      this.win = null
    }
  }
}
