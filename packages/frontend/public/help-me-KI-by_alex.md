# Companion Webpanel — Help & AI Context File

This file describes all features and configuration options of Companion Webpanel.
It is readable by humans, but primarily optimized for AI assistants.

> **Tip: Just hand this file to an AI agent.**
> Upload the file to ChatGPT, Claude, Gemini, Copilot or similar (or paste its content into the chat) and then ask your questions in plain language — e.g. *"How do I connect my panel to Companion at 192.168.1.20?"*, *"How do I build an audio channel for my X32?"* or *"Why does my host dot stay orange?"*.
> The agent then knows all features, settings and typical pitfalls and answers for your specific situation. It can also suggest Companion button texts, expressions or snippets of the settings JSON.
>
> Download: in the start window of the desktop app ("Download Help" below the version number) or in the panel via the `?` icon → "AI Context" tab.

---

## Getting Started

### Requirements

| What | Requirement |
|---|---|
| Bitfocus Companion | **4.3.0 or newer** (recommended: 5.0+ for WebP bitmaps, auto-discovery and page names) |
| Companion setting | **Enable "Button Subscriptions API"** (Companion → Settings → Protocols). Without this option the panel cannot connect (orange "caps-disabled" warning). |
| Network | The panel computer must reach the Companion computer: **TCP 16623** (Satellite API, WebSocket). Optional: **TCP 8000** (Companion HTTP API for page names) and **UDP 5353** (mDNS for auto-discovery, same subnet only). |
| Panel computer | Windows (desktop app, portable `.exe`) or any computer with Node.js (web app). |
| Control devices | Any device with a modern browser on the same LAN (PC, Mac, tablet, smartphone). The firewall on the panel computer must allow the panel port (default **8080**). |

### Your first panel in 6 steps

1. **Prepare Companion:** Start Companion and enable the "Button Subscriptions API" under Settings → Protocols. Create at least one page with buttons.
2. **Start Webpanel:** Launch the desktop app (`CompanionWebpanel-x.y.z.exe`). The start window opens, showing the port (default 8080) and the config file. On first start choose **"New Empty Config"** (the app never creates a file on its own) — or load an existing `.json` via `⋯`.
3. **Open the panel:** "Open in App" (own window) or "Open in Browser". Other devices on the LAN open `http://<IP-of-panel-computer>:8080`.
4. **Add a host:** Toolbar → Hosts icon → "Add host": name, IP of the Companion computer, port 16623. With Companion 5.0, instances on the same subnet appear automatically under "Discovered Companion instances" → "Add". Green dot in the toolbar = connected.
5. **Place buttons:** Edit mode (`E`) → toolbar "Add element" → CompanionButton → in the Properties panel choose Host, Page, Row, Col (the picker shows the Companion pages). Resize with the handles; group and label with Shapes and Labels.
6. **Operate & save:** `Ctrl+S` saves. View mode (`V`) → click/touch triggers the Companion button. For live use, optionally enable the Broadcast LED style in the canvas settings.

### Common first-time problems

- **Host dot stays orange/red:** wrong IP/port, Companion not running, firewall blocks TCP 16623, or Button Subscriptions not enabled in Companion.
- **Other devices can't reach the panel:** allow port 8080 in the firewall of the panel computer; `localhost` only works on the panel computer itself — use its LAN IP from other devices.
- **Buttons show nothing:** check Host/Page/Row/Col (the "Show host labels" toggle in the toolbar overlays `P·R/C`); the Companion button must exist.
- **Page names missing in the picker:** Companion HTTP API / port 8000 not reachable — numbers still work.
- **"Config file not found":** the file was moved/deleted (e.g. by OneDrive sync) — choose it again via `⋯` in the start window or create a new one.

---

## Instructions for AI agents

If you are an AI assistant and received this file as context, follow these rules:

1. **Role:** You are a support and configuration helper for *Companion Webpanel* (a touch panel for Bitfocus Companion). Answer questions about setup, operation, panel design, ChannelStrips, Companion button texts/expressions and troubleshooting.
2. **Source of truth:** Rely on this file. Do not invent features, menu items, shortcuts or settings fields that are not described here. If something is not documented, say so clearly and suggest the closest documented approach.
3. **Separate Companion from Webpanel:** In every instruction, make clear whether a step happens **in Companion** (buttons, actions, feedbacks, variables, modules) or **in the Webpanel** (elements, layout, properties). The Webpanel only mirrors and triggers Companion buttons — logic, actions and feedbacks always live in Companion.
4. **Ask when unclear:** Ask follow-up questions when important information is missing — e.g. Companion version, device/module in use (X32, vMix, OBS, ATEM …), network setup (same subnet? VPN?), desktop app or web app.
5. **Step by step:** Give numbered, concrete steps using the exact UI labels from this file. When troubleshooting, go from most to least likely (network/port → Companion setting → button reference).
6. **Settings JSON with care:** Prefer changes via the user interface. If you provide JSON snippets: valid JSON only, respect schema version `1.8.0`, and advise making a backup of the file first and closing the app while editing.
7. **Companion texts/expressions:** Provide button text templates and expressions as copyable code blocks. Use the variable syntax `$(module:variable)` and, for ChannelStrips, the template-button pattern with a local variable (see the ChannelStrip section). Point out that variable names depend on the specific Companion module and must be looked up in Companion.
8. **Mind the versions:** Features like WebP bitmaps, non-square buttons, auto-discovery and page names require Companion 5.0; the core functionality works from 4.3.0. State the requirement when an answer depends on it.
9. **Language:** Answer in the user's language. Keep answers short and practical — users are often under time pressure right before a live production.

---

## Project overview

Companion Webpanel is a freely designable touch panel for Bitfocus Companion. It lets you display and control many functions in a clear, structured and categorized way. The panel runs locally as a web app and is reachable from any device on the LAN (PC, Mac, tablet, smartphone) via the browser. Multiple users can be connected at the same time.

The panel communicates with Bitfocus Companion via the Satellite API (WebSocket on port 16623). Button states (bitmap, color, text) are synchronized in real time. Button presses are forwarded from the panel to Companion.

Minimum requirement: Bitfocus Companion 4.3.0 or newer, with the "Button Subscriptions API" option (`satellite_subscriptions_enabled`) enabled in the Companion settings.

From Companion 5.0 on, the panel automatically uses compressed WebP bitmaps (Satellite API 1.12) — button graphics are ~17× smaller than the raw RGB format of older Companion versions. In addition, non-square buttons (e.g. 2:1 wide format) are rendered by Companion with the matching aspect ratio instead of being padded with black bars — requirement: "Show bitmap" + "Scale bitmap" enabled on the element. Both happen transparently via feature detection; no configuration is needed, and with Companion 4.3 everything behaves as before.

Settings schema version: **1.8.0**

Available as:
- Web app: runs as a Node.js process, reachable in the browser at http://localhost:PORT
- Electron desktop app: standalone application with tray icon, start window and embedded browser

---

## Setting up connections (Hosts)

A host is a connection to a Bitfocus Companion instance. Multiple hosts can be connected at the same time — each host is a separate Companion instance (e.g. on different computers on the network).

Hosts are configured in the Host Manager (toolbar → Hosts icon).

Fields per host:
- Name: display name in the panel (free text)
- Host/IP: IP address or hostname of the Companion computer
- Port: WebSocket port of the Satellite API (default: 16623)
- HTTP port (httpPort): Companion admin/HTTP API port (default: 8000) — used for the automatic page names in the button picker; requires the HTTP API to be enabled in Companion and a firewall rule on the Companion host
- Auto connect (autoConnect): if disabled, this host is not connected on startup
- Show in toolbar (showInToolbar): if disabled, this host's status dot does not appear in the toolbar
- Notes: free text field
- Button grid: columns and rows for the button picker (default: 8×4)
- Max. pages: maximum number of pages in the picker dropdown

**Auto-discovery (Companion 5.0+):** While the Host Manager is open, the panel searches for Companion instances on the same subnet via mDNS. Found instances appear under "Discovered Companion instances" with an API version badge and can be added as a host directly via "Add" (name/IP/port pre-filled). mDNS does not cross subnets/VPNs — manual setup always works.

**Page names in the button picker:** The page dropdown automatically shows the page names assigned in Companion ("3 — Cameras"). The names come from the Companion HTTP API (see HTTP port) and are loaded as a batch when the picker opens (30 s cache). Page names configured locally in the host take precedence. If the HTTP API is not reachable, the dropdown simply shows numbers.

The connection status is shown in the toolbar as a colored dot per host:
- Blue/orange (animated): connecting
- Green: connected
- Orange: connection lost, reconnecting
- Red: error

If a host has not enabled the "Button Subscriptions API" in Companion, an orange warning appears with the path to the setting.

---

## Panel canvas

A panel is a configurable workspace containing elements. Multiple panels can be created (panel dropdown in the toolbar: + New, Rename, Duplicate, Delete).

Canvas configuration:
- Width and height in pixels (preset dropdown or manual input, e.g. 1920×1080)
- The last 5 used canvas sizes are remembered
- "Use available area": sets the canvas to the current window size minus the toolbar
- Canvas background color
- Texture: CSS-based background texture (none, leather, carbon, metal, linen, perforated, honeycomb, concrete, plastic/injection-molded, ABS glossy, plastic matte grained)
- DPI note for Windows scaling: enter the canvas size in logical CSS px, not physical pixels

**Broadcast LED style (global, `buttonStyle`):** Selectable in the canvas settings (Properties panel with no selection, edit mode): "Default" or "Broadcast LED". Applies app-wide to all CompanionButtons in all panels. The Broadcast LED style is an overlay style that wraps all buttons and re-interprets the Companion colors — it does not replace any button data:
- The Companion **background color (bgColor) becomes the LED signal color**: it no longer fills the surface but backlights the dark plastic cap (#1d1f23, inside a metal bezel) from within.
- The Companion **text color stays the legend color** on inactive buttons — the legend glows in its **own color**: red "CUT" lettering glows red even on a dark button. On **active** buttons the legend is backlit: the text color is raised to a near-white tint of the LED color and glows in two layers in the LED color — so the active state is clearly visible even with "Black cap".
- **Dark Companion colors (black/gray) = LED off** → plain dark cap. **Bright/saturated feedback colors (red, green, yellow) = fully lit** with outer glow. Companion feedback (color change when active) thus automatically becomes "LED lights up" — ideal for live production.
- When pressed, the cap moves down 3.5 px and the LED blooms (no more red pressed outline).
- Works with every existing button without data migration.

In the settings JSON: top-level field `"buttonStyle": "broadcast-led"` (omit = default).
Recommended in combination: canvas texture "plastic matte grained" on a dark background (#1a1c1f).

**Independently of this**, there is the physical dome button **per button** (`render.physicalStyle`, see CompanionButton properties) — a button with dome style keeps its dome look even when the Broadcast LED style is active.

Zoom:
- Ctrl+Scroll or the zoom control in the toolbar (20%–200%)
- **Auto-zoom (fit to window):** "Fit" button in the zoom flyout of the toolbar. When active, the canvas computes the zoom automatically so the whole canvas fits the window. The zoom adapts on every window resize. Ctrl+Scroll disables auto-zoom and takes over the current zoom value for manual zooming. Auto-zoom is stored per panel.

Grid:
- Visual grid lines (major + minor), toggle with the G key
- Snap: elements snap to the grid while dragging and resizing, toggle with the S key (edit mode only)

Modes:
- View mode (V): buttons trigger Companion actions, no dragging
- Edit mode (E): move, resize and configure elements — no button presses

---

## Canvas elements

### Layers (named layers)

Every element is assigned to one of four named layers. The layer determines the drawing order (stacking order). Within a layer there is an additional z-order.

Layers (bottom to top):
- **Background** (0): background elements (shapes, images)
- **Lower** (1): second layer
- **Main** (2): default for new elements
- **Overlay** (3): top layer (for labels, status overlays)

Change the layer in the Properties panel: 4 buttons (Background / Lower / Main / Overlay).
Order within a layer: "Bring forward" / "Send backward" (single selection).
Bring to front / Send to back: moves to the edge within the current layer.

### CompanionButton

Mirrors a Companion button in real time. Shows bitmap, background color and text exactly as Companion renders it.

Configurable properties:
- Host: which Companion instance (host ID)
- Page: Companion page (number)
- Row: row on the Companion page
- Col: column on the Companion page
- Border radius: rounded corners (px)
- Text align: text alignment (left, center, right)
- Scale bitmap (scaleBitmap): the Companion bitmap fills the button, even if it is larger than 72×72 px
- Bitmap resolution (bitmapSize): resolution of the bitmap requested from Companion — values: 72 / 100 / 144 / 200 px (default: 72). Only visible when "Show bitmap" is enabled. Higher resolution improves image quality on large buttons but increases data usage (quadratic: 144 px = 4× the data of 72 px). The backend subscribes to Companion with this value (`ADD-SUB BITMAP=N`) and re-subscribes automatically when the resolution changes.
- Companion color (showBgColor): use the Companion background color as the button background
- Show text (showText): show the Companion button text
- Font size: automatically limited to min. 7 px on small buttons
- Physical button / dome (physicalStyle): PER BUTTON — matte rubber/plastic cap in a recess with a concave well; the Companion background color tints cap and well. A dome button keeps its dome geometry in Broadcast LED mode but gets the legend glow there.
- Black cap (forceBlackCap): PER BUTTON — the checkbox is always visible/settable but only takes effect when the global Broadcast LED style is active. The cap ALWAYS stays at the reference black #1d1f23; the Companion color only acts as an LED (inner glow, outer glow, text glow), even in the active state. Applies to LED caps AND dome buttons (black dome with glowing legend). Purpose: uniform black hardware look where colors only carry signal meaning (e.g. red glowing "CUT" legend on a black cap).

In view mode: click/touch triggers a KEY-PRESS in Companion.

**Multi-button editing:** When ≥2 CompanionButtons are selected, a batch-edit panel appears in the Properties panel. Fields with mixed values show "—" (indeterminate). Only changed fields are applied to all selected buttons. Fields editable in batch mode: Host, showBgColor, showBitmap, bitmapSize, showText, textAlign, borderRadius, physicalStyle, forceBlackCap, fontSize.

**Host labels in edit mode:** The label icon button in the toolbar (edit mode, "Show host labels") overlays two semi-transparent labels on all CompanionButtons: the host name at the bottom and the Companion reference "P{Page} · R{Row}/C{Col}" at the top. Useful to check which button belongs to which host/Companion button.

### Shape

A rectangle for visually grouping elements on the canvas.

Configurable properties:
- Fill color (background color)
- Stroke color (border color)
- Stroke width (px)
- Border radius (px)
- Texture: CSS-based canvas texture (none, carbon, leather, metal, etc.)
- Finish: "Flat" (default) or "Plastic" — plastic adds injection-molded grain, a gloss gradient and 3D relief (like a console front panel)
- Opacity (0–100%)

Shape elements do not react to clicks in view mode.

### Label

Static text for captions, headings and category titles.

Configurable properties:
- Text content
- Text color
- Font size (px)
- Font family
- Font weight (Normal, Semi-Bold, Bold)
- Text alignment (left, center, right)

Label elements do not react to clicks in view mode.

### ChannelStrip

An audio mixer channel element. Displays level meters (meter L/R), fader, mute button, solo/PFL button, pan control and channel name. All values are driven by Companion button references. Each function can be enabled individually or left out.

#### Button 1 (basic function — enough for fader + mute + meter + name)

For the basic ChannelStrip function, **a single Companion button** (ref: Fader) is enough:

- **Push (KEY-PRESS):** mute on/off — the background color of the Companion button reports the mute state (e.g. red = muted, gray = active)
- **Rotate left/right (SUB-ROTATE):** volume down/up — the fader value in the button text updates
- **Button text with variables:** the Companion button text is parsed and provides meter values and channel name

Text format: the values in the button text are separated by a delimiter (default: `|`). The order is freely configurable via index settings.

The values do not come from Companion itself but from **Companion variables** — data that a connected device or software delivers live to Companion. Typical sources are hardware audio mixers (e.g. Behringer X32, Midas M32, Allen & Heath), software mixers (e.g. vMix Audio, OBS, REAPER) or other broadcast devices with a Companion module.

The Companion button text is configured as a template (with `$(module:variable)` syntax). At runtime Companion replaces the variables with current values — and sends the result as finished text to the Webpanel.

Example button text template (this is how you configure the Companion button):
```
$(x32:ch01_meterL)|$(x32:ch01_meterR)|$(x32:ch01_fader)|$(x32:ch01_name)
```

Example button text at runtime (this is how it arrives at the Webpanel, with current values):
```
67|71|82|Channel 1
```

Interpretation with configuration meterLIndex=0, meterRIndex=1, levelIndex=2, nameIndex=3:
- Index 0 → `67` = meter L (left level, 0–100)
- Index 1 → `71` = meter R (right level, 0–100)
- Index 2 → `82` = fader position (0–100)
- Index 3 → `Channel 1` = channel name

Simply leave out values you don't need (set the index to -1 or don't include the variable in the template).

Fader operation: vertical drag with mouse or touch also sends SUB-ROTATE to Companion.
Drum wheel: alternative scroll-wheel element, can be shown/hidden with the `showWheel` option.

#### Recommended pattern: template button with a local channel variable (Companion 5.0)

Instead of inserting three/four module variables per channel individually via the variable search into the button text, build **one template button per module** and duplicate it per channel — only one number changes.

**Step 1 — Define a local variable on the button:** e.g. `ch = 1`.

**Step 2 — Button text as an expression** (enable expression mode). The variable references are assembled dynamically and resolved with `parseVariables()`:

```
parseVariables(concat(
  '$(vmix:audio_meter_', $(local:ch), ')|',
  '$(vmix:audio_meter_', $(local:ch), ')|',
  '$(vmix:volume_',      $(local:ch), ')|',
  '$(vmix:input_',       $(local:ch), '_name)'
))
```

Runtime result e.g. `67|67|82|Camera 1` — matches the default indices exactly (meterL=0, meterR=1, level=2, name=3).

Important rules:
- **Do NOT include mute in the text.** The panel reads the mute state from the button's **background color** (Companion feedback), not from the text — a mute value in the text is ignored and only shifts the indices.
- **Delimiter = panel setting.** The ChannelStrip default is `|`. If you use `;` or similar in the template, you must set the same separator in the ChannelStrip.
- **Mono sources:** send the same meter variable for slots 0 and 1 (as above) — or send only one meter slot and set `meterRIndex = -1` in the panel.
- **Value ranges:** the panel expects meter and fader as **0–100**. If a module delivers 0–1 (e.g. `0.75`), scale in the expression: `round($(…) * 100)`. `-oo`/`-inf` from mixer modules is automatically interpreted as −∞.
- **Send the channel name directly** (slot 3) instead of maintaining it in the panel — it is then automatically correct when duplicating.

**Step 3 — Use the local variable everywhere in the button, not just in the text.** This is where the real time saving comes from — the whole button becomes channel-agnostic:
- **Press action** (mute toggle): input/channel = `$(local:ch)`
- **Rotary actions** left/right (volume ∓/±): input = `$(local:ch)` — rotary actions must be **enabled** on the button, otherwise neither fader drag nor drum wheel (SUB-ROTATE) work. The step size of the rotary action is the base granularity; Shift+Scroll in the panel multiplies it by the coarse multiplier.
- **Mute feedback** (bgColor, e.g. "Audio muted" → red): input = `$(local:ch)` — so the mute display in the panel is automatically correct.

**Step 4 — Channels 2–16:** copy the button in Companion, change only `ch`. In the panel, duplicate the ChannelStrip element (Ctrl+D) and just point the button reference to the new button.

The same pattern applies to the optional **Button 2** (solo/pan): same local variable, press = solo toggle, rotary = pan, solo feedback on bgColor.

#### Button 2 (optional — for solo/PFL and pan)

Solo/PFL and pan require a **second Companion button** (ref: Solo/Pan):

- **Push (KEY-PRESS):** solo/PFL on/off — the button's background color shows the solo state
- **Rotate left/right (SUB-ROTATE):** control the pan position (left/right)

The solo button is only shown in the ChannelStrip when this second button is configured.
The pan control is likewise only shown when this second button is configured.

Both functions (solo and pan) share the same button — push = solo, rotate = pan.

Configurable properties:
- Refs: Companion button reference for fader (button 1) and solo/pan (button 2)
- Separator
- Index per value (meterLIndex, meterRIndex, levelIndex, nameIndex)
- Show drum wheel (showWheel)
- Coarse multiplier: multiplier for the SUB-ROTATE step size (fader sensitivity)

### VirtualCompanionDeck

A standalone virtual Companion surface. Appears in Companion as a grid of buttons (like a physical Stream Deck). All buttons of this surface can be operated directly in the panel.

The difference to CompanionButton: VirtualCompanionDeck registers its own surface session with Companion. Companion treats it like a physical device. The entire grid is contained in a single element on the canvas.

Configurable properties:
- Cols: number of columns (1–16)
- Rows: number of rows (1–8)
- Empty button color: background color for empty buttons
- Physical style: 3D dome look for all buttons
- Scale bitmap (scaleBitmap)
- Text align
- Companion color (showBgColor)

---

## Edit mode functions

In edit mode (E key) elements can be edited:

- Drag: click and drag an element
- Resize: handles at the corners and edges of the element
- Grid snap: drag and resize snap to the grid (when snap is active)
- Multi-select lasso: drag on an empty canvas area → the lasso frame selects all overlapping elements
- Shift-click: add/remove individual elements to/from the selection
- Duplicate: Ctrl+D — duplicates all selected elements with a +75 px offset
- Delete: Del key — deletes all selected elements
- Copy style: Ctrl+Shift+C — copies the style properties of the selected element
- Paste style: Ctrl+Shift+V — applies the copied style to all selected elements
- Undo: Ctrl+Z
- Redo: Ctrl+Y
- Lock element: locked elements cannot be moved or deleted
- Properties panel: shown on the right when an element is selected — shows all configurable properties

**Copy elements between panels:** In edit mode with ≥1 selected element → Properties panel (bottom) → "Copy to panel" → dropdown with all other panels. The copied elements get new UUIDs and a +75 px offset.

**Duplicate a panel:** In the panel dropdown (toolbar) → ⧉ icon next to the panel name. Creates a complete duplicate with all elements and new UUIDs, name = "…Copy".

---

## Keyboard shortcuts

| Shortcut          | Action                                  |
|-------------------|-----------------------------------------|
| Ctrl+S            | Save                                    |
| Ctrl+Z            | Undo                                    |
| Ctrl+Y            | Redo                                    |
| Ctrl+D            | Duplicate element(s)                    |
| Ctrl+Shift+C      | Copy style                              |
| Ctrl+Shift+V      | Paste style                             |
| V                 | Activate view mode                      |
| E                 | Activate edit mode                      |
| G                 | Grid on/off                             |
| S                 | Snap on/off (edit mode only)            |
| Del / Backspace   | Delete selected elements                |
| ↑ ↓ ← →           | Move element (1 px)                     |
| Shift + ↑ ↓ ← →   | Move element (10 px)                    |
| Escape            | Clear selection                         |
| Ctrl+Scroll       | Change zoom (disables auto-zoom)        |

---

## Settings

Settings are stored in a JSON file. Default path in the Electron app: `userData/companionwebpanel.json` (new installations) or `userData/settings.json` (upgrade from older versions). In the web app the file lives next to the backend process.

Configurable settings:
- Server port (default: 8080): which port the backend runs on
- Language (language): de (German) or en (English) — applies to all UI strings
- Hosts: list of all Companion connections (see "Setting up connections")
- Panels: all canvas panels with their elements and canvas settings
- settingsPath: optional ~-normalized path to the settings file (for a custom settings path; written into the file itself for cross-device sync)

**Custom settings path:** The settings file can live in any folder — e.g. OneDrive or iCloud for automatic synchronization between devices. The path is stored machine-locally in `userData/meta.json` (not in the cloud file itself). On startup the app first reads `meta.json` to determine the path to the actual settings file.

---

## Electron app

The Electron version runs as a desktop application:

- Tray icon in the taskbar: right-click opens the context menu with quick access
- Start window (400×365 px): shows connection status, port and quick-access buttons
  - **"Download Help"** (below the version number, top right): saves this help file (`help-me-KI-by_alex.md`) via a save dialog, default folder "Downloads"
  - Port field: change port → Apply → app restarts with the new port
  - **"Config File" section:** shows the active settings file
    - File name field with `⋯` button (hover: "Load Config File…"): opens a file dialog, choose an existing `.json` file → app restarts automatically with the new file
    - **"New Empty Config" button** (document+plus icon): opens a save dialog, creates an empty settings file at the chosen location → app restarts automatically with the new empty configuration
  - "Open in App": opens the panel in an embedded window (1280×720 px)
  - "Open in Browser": opens the panel in the default browser
- Single instance: only one instance at a time; a second instance brings the start window to the front
- Closing all windows keeps the app running (tray app)
- Quit: via tray menu → confirmation dialog
