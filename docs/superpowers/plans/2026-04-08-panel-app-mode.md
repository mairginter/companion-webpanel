# Panel APP-Modus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panel als natives Electron-Fenster öffnen (kein Browser-Chrome), zusätzlich zur bestehenden Browser-Option.

**Architecture:** Neue `PanelWindow`-Klasse verwaltet ein einzelnes BrowserWindow. Tray und Startup-Fenster bekommen je zwei Öffnen-Optionen: "Open in App" (PanelWindow) und "Open in Browser" (shell.openExternal).

**Tech Stack:** Electron 33, TypeScript, esbuild (build via `node build.mjs`)

---

## File Map

| Aktion | Datei | Was |
|---|---|---|
| Create | `packages/electron/src/panelWindow.ts` | PanelWindow-Klasse |
| Modify | `packages/electron/src/tray.ts` | 2 neue Callbacks, 2 Menü-Einträge |
| Modify | `packages/electron/src/main.ts` | PanelWindow instanziieren, IPC-Handler, Tray-Args, Shutdown |
| Modify | `packages/electron/src/preload.ts` | `openPanelApp()` hinzufügen |
| Modify | `packages/electron/renderer/startup.html` | Button umbenennen + neuen Button |

---

### Task 1: PanelWindow-Klasse erstellen

**Files:**
- Create: `packages/electron/src/panelWindow.ts`

- [ ] **Schritt 1: Datei erstellen**

```typescript
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
    this.win.loadURL(url)

    this.win.on('closed', () => {
      this.win = null
    })
  }

  /** Zerstört das Fenster (nur beim echten App-Quit). */
  destroy(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy()
      this.win = null
    }
  }
}
```

- [ ] **Schritt 2: TypeScript-Check**

```bash
cd packages/electron && npx tsc --noEmit
```

Expected: keine Fehler

- [ ] **Schritt 3: Commit**

```bash
git add packages/electron/src/panelWindow.ts
git commit -m "feat: PanelWindow-Klasse für APP-Modus"
```

---

### Task 2: tray.ts — zwei Öffnen-Callbacks + Menü-Einträge

**Files:**
- Modify: `packages/electron/src/tray.ts`

Aktueller Konstruktor:
```typescript
constructor(onShowWindow: () => void, onQuit: () => void)
```

- [ ] **Schritt 1: Konstruktor + Felder erweitern**

Ändere die Klassen-Felder und den Konstruktor:

```typescript
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
```

- [ ] **Schritt 2: rebuildMenu aktualisieren**

Ersetze die ersten zwei Einträge im Menu-Template:

```typescript
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
```

- [ ] **Schritt 3: TypeScript-Check**

```bash
cd packages/electron && npx tsc --noEmit
```

Expected: Fehler in `main.ts` weil Tray-Konstruktor jetzt 4 Argumente braucht — das wird in Task 3 behoben.

- [ ] **Schritt 4: Commit**

```bash
git add packages/electron/src/tray.ts
git commit -m "feat: Tray — Open in App + Open in Browser Einträge"
```

---

### Task 3: main.ts — PanelWindow + IPC + Tray-Argumente + Shutdown

**Files:**
- Modify: `packages/electron/src/main.ts`

- [ ] **Schritt 1: Import hinzufügen**

Füge `PanelWindow` zum Import-Block hinzu:

```typescript
import { PanelWindow } from './panelWindow'
```

- [ ] **Schritt 2: PanelWindow instanziieren**

Direkt nach der `startupWindow`-Zeile:

```typescript
  const startupWindow = new StartupWindow()
  startupWindow.create()

  const panelWindow = new PanelWindow()
```

- [ ] **Schritt 3: open-panel-app IPC-Handler + open-panel umbenennen**

Ersetze den bestehenden `open-panel` Handler und füge `open-panel-app` hinzu:

```typescript
  // Fix #4: Fenster beim Open Panel nicht schließen
  ipcMain.handle('open-panel', () => {
    shell.openExternal(`http://localhost:${appStatus.port}`)
  })

  ipcMain.handle('open-panel-app', () => {
    panelWindow.open(`http://localhost:${appStatus.port}`)
  })

  ipcMain.on('hide-window', () => startupWindow.hide())
```

- [ ] **Schritt 4: Tray-Konstruktor mit 4 Argumenten aufrufen**

Ersetze die Tray-Konstruktion:

```typescript
  const tray = new AppTray(
    () => panelWindow.open(`http://localhost:${appStatus.port}`),
    () => shell.openExternal(`http://localhost:${appStatus.port}`),
    () => startupWindow.show(),
    () => shutdown(),
  )
```

- [ ] **Schritt 5: PanelWindow im Shutdown zerstören**

In der `shutdown()`-Funktion nach `startupWindow.destroy()`:

```typescript
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
```

- [ ] **Schritt 6: TypeScript-Check**

```bash
cd packages/electron && npx tsc --noEmit
```

Expected: keine Fehler

- [ ] **Schritt 7: Commit**

```bash
git add packages/electron/src/main.ts
git commit -m "feat: main.ts — PanelWindow integriert, open-panel-app IPC"
```

---

### Task 4: preload.ts + startup.html

**Files:**
- Modify: `packages/electron/src/preload.ts`
- Modify: `packages/electron/renderer/startup.html`

- [ ] **Schritt 1: preload.ts — openPanelApp hinzufügen**

Füge nach `openPanel` ein:

```typescript
  openPanelApp: (): Promise<void> =>
    ipcRenderer.invoke('open-panel-app'),
```

- [ ] **Schritt 2: startup.html — Button-Zeile aktualisieren**

Ersetze die actions-div:

```html
    <div class="actions">
      <button class="btn-secondary" id="btnOpenApp">Open in App</button>
      <button class="btn-secondary" id="btnOpen">Open in Browser</button>
      <button class="btn-secondary" id="btnHide">Hide</button>
      <button class="btn-secondary" id="btnQuit">Quit</button>
    </div>
```

- [ ] **Schritt 3: startup.html — btnOpenApp verdrahten**

Füge im Script-Block nach den bestehenden Button-Handlern hinzu:

```javascript
    document.getElementById('btnOpenApp').addEventListener('click', () => api.openPanelApp())
```

- [ ] **Schritt 4: TypeScript-Check**

```bash
cd packages/electron && npx tsc --noEmit
```

Expected: keine Fehler

- [ ] **Schritt 5: Commit**

```bash
git add packages/electron/src/preload.ts packages/electron/renderer/startup.html
git commit -m "feat: preload + startup.html — Open in App Button"
```

---

### Task 5: Build + Manueller Test

- [ ] **Schritt 1: Electron-Build**

```bash
npm run build -w @cwp/electron
```

Expected:
```
Frontend dist kopiert → packages/electron/frontend/
Electron build complete.
```

- [ ] **Schritt 2: Electron starten**

```bash
node scripts/launch-electron.mjs
```

- [ ] **Schritt 3: Prüfen**

- [ ] Startup-Fenster zeigt 4 Buttons: "Open in App", "Open in Browser", "Hide", "Quit"
- [ ] "Open in App" → öffnet neues Electron-Fenster ohne Browser-Chrome (kein URL-Feld, kein Tab-Leiste)
- [ ] "Open in Browser" → öffnet Standard-Browser
- [ ] Zweiter Klick auf "Open in App" → fokussiert bestehendes Fenster statt neues
- [ ] Tray-Menü zeigt "Open in App" + "Open in Browser"
- [ ] Tray "Open in App" → gleich wie Button
- [ ] Quit → schließt beide Fenster sauber (exit 0)

- [ ] **Schritt 4: Commit nach erfolgreichem Test**

```bash
git add -A
git commit -m "fix: Panel APP-Modus — finaler Build nach manuellem Test"
```
