# Design: Auto-Zoom + Custom Settings Path (v1.7.0)

**Datum:** 2026-05-01  
**Schema-Version:** 1.6.0 → 1.7.0  
**Features:** Auto-Zoom per Panel, Custom Settings Path + Dateiname-Umbenennung

---

## Übersicht

Zwei unabhängige Features, die in einem Schema-Bump gebündelt werden:

1. **Auto-Zoom** — Panel-Zoom passt sich automatisch ans Fenster an (Fit-to-Window)
2. **Custom Settings Path** — Einstellungsdatei kann in beliebigem Ordner liegen (z.B. OneDrive/iCloud-Sync-Ordner)

Zusätzlich: Umbenennung der Standard-Settings-Datei von `settings.json` → `companionwebpanel.json`.

---

## Feature 1: Auto-Zoom

### Ziel

Ein Panel kann dauerhaft auf "Fit to Window" gestellt werden, sodass der Zoom-Faktor automatisch berechnet wird wenn sich die Fenstergröße ändert. Nützlich für Multi-Device-Workflows (Desktop 24", iPad 11").

### Datenmodell

```typescript
// packages/shared/src/types.ts
interface Panel {
  // ... bestehende Felder ...
  autoZoom?: boolean  // NEU — default undefined = false
}
```

Schema-Bump erforderlich (Panel-Typ ändert sich).

### Store-Änderung

```typescript
// packages/frontend/src/store/useAppStore.ts
setAutoZoom: (panelId: string, value: boolean) => void
```

Implementierung analog zu `setZoom` — setzt `panel.autoZoom` und speichert via normalen Settings-Save-Pfad.

### Canvas.tsx — Resize-Logik

- `ResizeObserver` auf `scrollWrapperRef` wenn `panel.autoZoom === true`
- Formel: `fitZoom = Math.min(containerW / canvasW, containerH / canvasH)`
- Canvas-Größe: `panel.canvas?.width ?? 1920` / `panel.canvas?.height ?? 1080`
- Debounced 50 ms (vermeidet Resize-Storms)
- Ruft `setZoom(panel.id, fitZoom)` auf (klemmt intern auf [0.2, 2.0])
- Observer wird bei `autoZoom === false` oder Panel-Wechsel aufgeräumt (disconnect)

**Ctrl+Scroll-Interaktion:** Wenn `panel.autoZoom` aktiv und User scrollt → `setAutoZoom(panel.id, false)` zuerst, dann manueller Zoom. User übernimmt explizit die Kontrolle.

### ZoomControl.tsx — UI-Änderungen

Neue Props:
```typescript
autoZoom: boolean
onAutoZoomChange: (value: boolean) => void
```

Layout im Flyout (unter Slider):
```
[Slider ──────────────────] 85%
[100%]  [⊡ Fit]
```

- `fit_screen` Material Icon + Text "Fit"
- Aktiv-State: gleicher blauer Tint (`rgba(74,158,255,0.12)` + `#4a9eff`-Border) wie bei anderen aktiven Controls
- Wenn `autoZoom` aktiv: Slider `opacity: 0.4`, `pointerEvents: 'none'` (visuell deaktiviert, nicht ausgeblendet)
- Wenn `autoZoom` aktiv: Zoom-% im Toolbar-Button zeigt berechneten Wert

### Migration

Kein Migrations-Code nötig — `autoZoom?: boolean` ist optional, `undefined` wird als `false` behandelt. Nur Schema-Version-Bump.

---

## Feature 2: Custom Settings Path

### Ziel

Die Einstellungsdatei kann in einem Cloud-Sync-Ordner (OneDrive, iCloud, Google Drive) abgelegt werden. Beim Start wird der konfigurierte Pfad geladen, auf einem neuen Gerät muss der Pfad einmalig gesetzt werden.

### Dateiname — Default für neue Installationen

`companionwebpanel.json` ist der neue Default-Name — **nur für neue Installationen** (wenn noch keine Settings-Datei existiert). Bestehende Installationen behalten ihren bisherigen Namen (`settings.json`) unverändert. **Kein automatischer Umbenennung.** Der Benutzer kann über "Load Preference File" jederzeit eine beliebig benannte `.json`-Datei wählen.

`getSettingsPath()` gibt `companionwebpanel.json` zurück — wird aber nur aufgerufen wenn kein meta.json und keine `settings.json` existiert (Backwards-Compat-Logik in main.ts, siehe unten).

### Neue Datei: `metaConfig.ts`

```typescript
// packages/electron/src/metaConfig.ts
interface MetaConfig {
  settingsPath?: string  // absoluter Pfad, maschinenspezifish — NICHT in Cloud
}

function loadMeta(userDataPath: string): MetaConfig
function saveMeta(userDataPath: string, meta: MetaConfig): void
// Pfad: userData/meta.json
```

### Pfad-Normalisierung

```typescript
// in metaConfig.ts
function normalizePath(abs: string): string  // os.homedir() → "~"
function expandPath(norm: string): string    // "~" → os.homedir()
```

Beispiele:
- Windows: `C:\Users\mairg\OneDrive - Alex Mairginter\Documents\CWP\companionwebpanel.json`  
  → `~\OneDrive - Alex Mairginter\Documents\CWP\companionwebpanel.json`
- macOS: `/Users/mairg/Library/CloudStorage/OneDrive-.../companionwebpanel.json`  
  → `~/Library/CloudStorage/OneDrive-.../companionwebpanel.json`

Plattform-Hinweis: Windows→Mac bleibt manuell (zu unterschiedliche Pfadstruktur). `~`-Normalisierung hilft wenn Home-Ordner-Name auf verschiedenen Geräten gleicher OS-Familie gleich ist.

### Settings-Typ (v1.7.0)

```typescript
interface Settings {
  version: '1.7.0'
  settingsPath?: string  // NEU — ~-normalisiert, optional, wird in Cloud-Datei gespeichert
  // ... alle bestehenden Felder ...
}
```

### Startup-Logik in `main.ts`

```
1. meta = loadMeta(userDataPath)

2. Wenn meta.settingsPath gesetzt:
     resolvedPath = expandPath(meta.settingsPath)
   Sonst (kein meta.json / kein Pfad):
     Wenn userData/settings.json existiert:
       resolvedPath = userData/settings.json          ← Backwards-Compat für Upgrades
     Sonst:
       resolvedPath = userData/companionwebpanel.json  ← neuer Default für Neuinstallationen

3. settings = loadSettings(resolvedPath)

4. Wenn settings.settingsPath gesetzt:
   expandedFromSettings = expandPath(settings.settingsPath)
   Wenn expandedFromSettings ≠ resolvedPath:
     → settings gewinnt (Redirect)
     resolvedPath = expandedFromSettings
     settings = loadSettings(resolvedPath)
     saveMeta(userDataPath, { settingsPath: normalizePath(resolvedPath) })

5. resolvedPath als activeSettingsPath → Backend übergeben
   (statt hartem getSettingsPath(userDataPath))
```

### Neue IPC-Handler in `main.ts`

| IPC-Kanal | Richtung | Beschreibung |
|---|---|---|
| `get-settings-path` | invoke → string | Gibt `normalizePath(resolvedPath)` zurück |
| `choose-settings-path` | invoke → string \| null | `dialog.showOpenDialog` mit `defaultPath = path.dirname(resolvedPath)`, Filter `.json` |
| `apply-settings-path` | invoke(path) → void | Schreibt in `meta.json` + `settings.settingsPath`, dann `app.relaunch() + app.quit()` |

**apply-settings-path Ablauf:**
1. `settings.settingsPath = normalizePath(newAbsPath)` → in aktuelle settings-Datei schreiben
2. `saveMeta({ settingsPath: normalizePath(newAbsPath) })`
3. `app.relaunch()` → `app.quit()`

### `preload.ts` Erweiterungen

```typescript
getSettingsPath: (): Promise<string>
chooseSettingsPath: (): Promise<string | null>
applySettingsPath: (path: string) => Promise<void>
```

### Startup-Fenster UI (`startup.html`)

Neue Zeile zwischen Port-Zeile und Hosts-Liste. Fenster-Höhe: 400×240 → 400×270.

```html
<!-- Preference-File-Zeile -->
<div class="preffile-row">
  <span class="preffile-name" id="prefFileName">companionwebpanel.json</span>
  <button class="port-apply" id="btnLoadPref">Load Preference File</button>
</div>
```

**Verhalten:**
- `prefFileName` zeigt nur den Dateinamen — da `path`-Modul in startup.html nicht verfügbar ist, Basename-Extraktion via `normalizedPath.replace(/\\/g, '/').split('/').pop()`
- Klick → `api.chooseSettingsPath()` → wenn nicht null → `api.applySettingsPath(path)` → App startet neu
- Datei-Dialog öffnet in `path.dirname(resolvedPath)` (absoluter Pfad, intern in main.ts aufgelöst — Renderer bekommt nur Ergebnis)

**i18n:** Neuer String `loadPreferenceFile` in den i18n-Dateien; `get-i18n-strings` IPC entsprechend erweitern.

---

## Schema-Bump v1.6.0 → v1.7.0

Beide Features zusammen. Migration: nur Version-Bump (alle neuen Felder optional).

**6 Dateien (Pflicht laut CLAUDE.md):**

| Datei | Änderung |
|---|---|
| `CompanionWebpannelSettings.schema.json` | Version → 1.7.0, `settingsPath` + `panel.autoZoom` ergänzen |
| `packages/shared/src/types.ts` | `Settings.settingsPath?: string`, `Panel.autoZoom?: boolean`, Version |
| `packages/backend/src/standalone.ts` | Version-Check 1.7.0 |
| `packages/backend/src/server/ClientServer.ts` | Version-Check 1.7.0 |
| `CompanionWebpannelSettings.json` | Version → 1.7.0 |
| `packages/electron/src/settingsHelper.ts` | `getDefaultSettings()` v1.7.0, `getSettingsPath()` → `companionwebpanel.json` (nur neuer Default), v1.6.0→v1.7.0 Migrations-Stub |

**Test-Fixture:** `makeSettings()` in `useAppStore.test.ts` → `version: '1.7.0'`

---

## Dateien-Übersicht (alle Änderungen)

| Datei | Art |
|---|---|
| `packages/electron/src/metaConfig.ts` | NEU |
| `packages/electron/src/settingsHelper.ts` | Umbenennung + Migration |
| `packages/electron/src/main.ts` | Startup-Logik + 3 IPC-Handler |
| `packages/electron/src/preload.ts` | 3 neue API-Methoden |
| `packages/electron/renderer/startup.html` | Preference-File-Zeile + i18n |
| `packages/electron/src/startupWindow.ts` | Fensterhöhe 240 → 270 |
| `packages/shared/src/types.ts` | `Panel.autoZoom`, `Settings.settingsPath`, v1.7.0 |
| `packages/frontend/src/store/useAppStore.ts` | `setAutoZoom` Action |
| `packages/frontend/src/components/Canvas/Canvas.tsx` | ResizeObserver + autoZoom-Logik |
| `packages/frontend/src/components/Toolbar/ZoomControl.tsx` | Fit-Button + neue Props |
| `packages/frontend/src/components/Toolbar/Toolbar.tsx` | autoZoom Props weiterreichen |
| `packages/frontend/src/App.tsx` | autoZoom State + Callbacks |
| Schema + Settings JSON + backend Stubs | Schema-Bump |
| i18n-Dateien (`de.json`, `en.json`) | `loadPreferenceFile` String |

---

## Nicht im Scope

- Windows→Mac Pfad-Portabilität (manuelles Setzen pro Gerät ist akzeptabel)
- File-Locking / Read-Only-Modus (separates Feature, späterer Zeitpunkt)
- Hotkey für Auto-Zoom
