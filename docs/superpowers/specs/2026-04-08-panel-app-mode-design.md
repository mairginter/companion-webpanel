# Panel APP-Modus — Design Spec

**Datum:** 2026-04-08  
**Status:** Approved  
**Scope:** Electron Wrapper (packages/electron)

---

## Ziel

Das Panel soll direkt als natives Electron-Fenster ohne Browser-Chrome geöffnet werden können. Zusätzlich bleibt "Open in Browser" als Alternative erhalten.

---

## Neue Komponente: PanelWindow

**Datei:** `packages/electron/src/panelWindow.ts`

Verwaltet ein einzelnes `BrowserWindow` für das Panel:

- **Fenster-Eigenschaften:** Standard OS-Titelleiste, Titel "Companion Webpanel", kein Menübalken (`autoHideMenuBar: true`)
- **Größe:** Default 1280×720, resizable, min. 640×400
- **Inhalt:** Lädt `http://localhost:<port>` (nicht `loadFile` — Backend serviert Frontend)
- **Icon:** `assets/icon-256.png` (Taskbar + Titlebar)
- **Bereits offen:** `show()` + `focus()` statt zweites Fenster öffnen
- **Schließen:** Fenster wird zerstört (nicht versteckt — anders als StartupWindow)
- **Shutdown:** `destroy()` in `main.ts` shutdown-Funktion aufrufen

**API:**
```typescript
class PanelWindow {
  open(url: string): void   // öffnet oder fokussiert
  destroy(): void           // zerstört (nur beim App-Quit)
}
```

---

## Startup-Fenster

**Aktuelle Button-Zeile:** `[Open Panel]` `[Hide]` `[Quit]`  
**Neue Button-Zeile:** `[Open in App]` `[Open in Browser]` `[Hide]` `[Quit]`

- Alle vier Buttons gleichwertig nebeneinander
- `[Open in App]` und `[Open in Browser]` beide `btn-secondary` Stil (gleichwertig, Option A)
- Beide Buttons schließen das Startup-Fenster nicht

**Preload — neue Funktion:**
```typescript
openPanelApp(): Promise<void>  // → IPC 'open-panel-app'
```

---

## Tray-Menü

**Aktuell:**
```
Open Panel
─────────────
● Host...
─────────────
Show Window
Quit
```

**Neu:**
```
Open in App
Open in Browser
─────────────
● Host...
─────────────
Show Window
Quit
```

---

## Änderungen an bestehenden Dateien

| Datei | Änderung |
|---|---|
| `src/panelWindow.ts` | Neue Datei |
| `src/main.ts` | `PanelWindow` instanziieren, IPC `open-panel-app` Handler, `destroy()` im shutdown |
| `src/tray.ts` | Constructor: `onOpenApp` + `onOpenBrowser` statt `onShowPanel`; Menü-Einträge updaten |
| `src/preload.ts` | `openPanelApp()` hinzufügen |
| `renderer/startup.html` | Button-Zeile: 4 Buttons, `btnOpenApp` + bestehender `btnOpen` (Browser) |

---

## Nicht im Scope

- Persistenz der Fenstergröße/-position (spätere Session)
- Mehrere Panel-Fenster gleichzeitig
- Kiosk-Modus / Fullscreen-Option
