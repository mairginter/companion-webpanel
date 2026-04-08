/**
 * panelWindow.ts — Panel-Fenster (APP-Modus)
 *
 * Öffnet das Webpanel als natives Electron-Fenster ohne Browser-Chrome.
 * Verwaltet eine einzelne BrowserWindow-Instanz — bereits offen: fokussieren statt neu.
 */
import { BrowserWindow } from 'electron'
import * as path from 'path'

export class PanelWindow {
  private win: BrowserWindow | null = null
  private iconPath: string

  constructor() {
    this.iconPath = path.join(__dirname, '..', 'assets', 'icon-256.png')
  }

  /** Öffnet das Panel-Fenster oder fokussiert es wenn bereits offen. */
  open(url: string): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.loadURL(url).catch((err) => {
        console.error('[PanelWindow] loadURL fehlgeschlagen:', err)
      })
      this.win.show()
      this.win.focus()
      return
    }

    this.win = new BrowserWindow({
      width: 1280,
      height: 720,
      minWidth: 640,
      minHeight: 400,
      backgroundColor: '#0f141a',
      icon: this.iconPath,
      title: 'Companion Webpanel',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    this.win.setMenuBarVisibility(false)
    this.win.loadURL(url).catch((err) => {
      console.error('[PanelWindow] loadURL fehlgeschlagen:', err)
    })

    this.win.on('closed', () => {
      this.win = null
    })
  }

  /** Zerstört das Fenster (nur beim echten App-Quit). */
  destroy(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.removeAllListeners()
      this.win.destroy()
      this.win = null
    }
  }
}
