import { create } from 'zustand'
import {
  KeyState,
  Settings,
  HostProfile,
  Panel,
  AnyElement,
  DeltaMessage,
  SnapshotMessage,
  SessionStatusMessage,
  HostInfoMessage,
  VDeltaMessage,
  VSnapshotMessage,
  VSessionStatusMessage,
  pageKey,
  defaultLayerFor,
} from '@cwp/shared'

type SessionStatus = SessionStatusMessage['status']

interface AppStore {
  // ─── Settings ────────────────────────────────────────────────────────────
  settings: Settings | null
  activePanelId: string | null
  setSettings: (s: Settings) => void
  setActivePanelId: (id: string) => void
  getActivePanel: () => Panel | null

  // ─── Canvas Mode ─────────────────────────────────────────────────────────
  mode: 'view' | 'edit'
  setMode: (mode: 'view' | 'edit') => void
  toggleMode: () => void

  // ─── Button State ─────────────────────────────────────────────────────────
  /** key: "hostId:page:row:col" → KeyState */
  buttons: Record<string, KeyState>
  applyDelta: (msg: DeltaMessage) => void
  applySnapshot: (msg: SnapshotMessage) => void

  // ─── Session Status ───────────────────────────────────────────────────────
  /** key: hostId → status (pro Host, nicht pro Page) */
  sessionStatus: Record<string, SessionStatus>
  applySessionStatus: (msg: SessionStatusMessage) => void
  /** Alle bekannten Sessions auf 'stale' setzen — bei WS-Disconnect zum Backend */
  markAllSessionsStale: () => void

  // ─── Host Info (Companion-Version nach Handshake) ─────────────────────────
  /** key: hostId → { companionVersion, apiVersion } */
  hostInfo: Record<string, { companionVersion: string; apiVersion: string }>
  applyHostInfo: (msg: HostInfoMessage) => void

  // ─── Virtual Deck State ───────────────────────────────────────────────────
  /** key: deviceId → Record<keyIndex as string, KeyState> */
  virtualKeys: Record<string, Record<string, KeyState>>
  applyVDelta: (msg: VDeltaMessage) => void
  applyVSnapshot: (msg: VSnapshotMessage) => void
  getVirtualKeyState: (deviceId: string, keyIndex: number) => KeyState | undefined

  /** key: deviceId → status */
  virtualSessionStatus: Record<string, 'connecting' | 'connected' | 'stale' | 'error'>
  applyVSessionStatus: (msg: VSessionStatusMessage) => void
  getVirtualSessionStatus: (deviceId: string) => string | undefined

  // ─── Host CRUD ────────────────────────────────────────────────────────────
  addHost: (host: HostProfile) => void
  updateHost: (host: HostProfile) => void
  /** Löscht einen Host. deleteRefs=true entfernt auch alle Panel-Elemente die diesen Host referenzieren. */
  removeHost: (hostId: string, deleteRefs: boolean) => void

  // ─── Panel CRUD ───────────────────────────────────────────────────────────
  /** Neues leeres Panel anlegen, wird sofort aktiv */
  createPanel: (name: string) => Panel
  renamePanel: (panelId: string, name: string) => void
  /** Panel löschen. Falls aktiv, wird das nächste Panel aktiviert. Gibt false zurück wenn es das letzte Panel ist. */
  deletePanel: (panelId: string) => boolean
  /** Setzt den Zoom-Faktor eines Panels. Klemmt auf [0.2, 2.0]. */
  setZoom: (panelId: string, zoom: number) => void
  /** Dupliziert ein Panel mit allen Elementen (neue IDs), wechselt dazu. */
  duplicatePanel: (panelId: string) => Panel
  /** Kopiert Elemente aus sourcePanelId nach targetPanelId mit +75px Offset und neuen IDs. */
  copyElementsToPanel: (sourcePanelId: string, targetPanelId: string, elementIds: string[]) => void

  // ─── Edit Mode ────────────────────────────────────────────────────────────
  selectedIds: Set<string>
  selectElement: (id: string, addToSelection: boolean) => void
  selectElements: (ids: string[]) => void
  clearSelection: () => void

  updateElementGeometry: (
    panelId: string,
    elementId: string,
    patch: Partial<{ x: number; y: number; w: number; h: number }>,
  ) => void

  updateElement: (panelId: string, elementId: string, patch: Partial<AnyElement>) => void

  _undoSnapshot: Record<string, { x: number; y: number; w: number; h: number; panelId: string }> | null
  _redoSnapshot: Record<string, { x: number; y: number; w: number; h: number; panelId: string }> | null
  saveUndoSnapshot: (elementIds: string[]) => void
  undo: () => void
  redo: () => void

  duplicateElements: (panelId: string, ids: string[]) => void
  deleteElements: (panelId: string, ids: string[]) => void
  addElement: (panelId: string, element: AnyElement) => void

  // ─── Edit UI State ────────────────────────────────────────────────────────
  showHostLabels: boolean
  setShowHostLabels: (v: boolean) => void

  // ─── Layer System ─────────────────────────────────────────────────────────
  /** Move one or more elements to a named layer (0=Background … 3=Overlay). Works for multi-select. */
  moveToLayer: (panelId: string, elementIds: string[], layer: number) => void
  /** Move one element one step forward within its layer */
  bringForward: (panelId: string, elementId: string) => void
  /** Move one element one step backward within its layer */
  sendBackward: (panelId: string, elementId: string) => void

  // ─── Style Copy/Paste ─────────────────────────────────────────────────────
  copiedStyle: {
    type: AnyElement['type']
    w: number
    h: number
    /** style (shape/label/channelStrip) oder render (companionButton/virtualCompanionDeck) */
    payload: Record<string, unknown>
  } | null
  copyElementStyle: (panelId: string, elementId: string) => void
  pasteElementStyle: (panelId: string, targetIds: string[]) => void

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getButtonState: (hostId: string, page: number, row: number, col: number) => KeyState | undefined
  /** Verbindungsstatus eines Hosts (kein page-Parameter mehr nötig) */
  getSessionStatus: (hostId: string) => SessionStatus | undefined
  /** Gibt true zurück wenn hostId in settings.hosts existiert */
  hostExists: (hostId: string) => boolean
}

export const useAppStore = create<AppStore>((set, get) => ({
  // ─── Settings ─────────────────────────────────────────────────────────────
  settings: null,
  activePanelId: null,

  setSettings: (settings) => {
    set((s) => {
      // activePanelId nur ändern wenn das aktuelle Panel nicht mehr in den neuen Settings existiert
      const stillExists = settings.panels.some((p) => p.id === s.activePanelId)
      const activePanelId = stillExists ? s.activePanelId : (settings.panels[0]?.id ?? null)
      return { settings, activePanelId }
    })
  },

  setActivePanelId: (id) => set({ activePanelId: id }),

  getActivePanel: () => {
    const { settings, activePanelId } = get()
    if (!settings || !activePanelId) return null
    return settings.panels.find((p) => p.id === activePanelId) ?? null
  },

  // ─── Mode ─────────────────────────────────────────────────────────────────
  mode: 'view',
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((s) => ({ mode: s.mode === 'view' ? 'edit' : 'view' })),

  // ─── Buttons ──────────────────────────────────────────────────────────────
  buttons: {},

  applyDelta: (msg) => {
    // Key-Format: "hostId:page:row:col"
    const k = `${pageKey(msg.hostId, msg.page)}:${msg.row}:${msg.col}`
    set((s) => ({
      buttons: {
        ...s.buttons,
        [k]: {
          ...s.buttons[k],
          ...(msg.bgColor !== undefined && { bgColor: msg.bgColor }),
          ...(msg.textColor !== undefined && { textColor: msg.textColor }),
          ...(msg.text !== undefined && { text: msg.text }),
          ...(msg.bitmap !== undefined && { bitmap: msg.bitmap }),
        },
      },
    }))
  },

  applySnapshot: (msg) => {
    // msg.keys: Record<"row:col", KeyState>
    const prefix = pageKey(msg.hostId, msg.page)
    const updates: Record<string, KeyState> = {}
    for (const [rowCol, state] of Object.entries(msg.keys)) {
      updates[`${prefix}:${rowCol}`] = state
    }
    set((s) => {
      const filtered = Object.fromEntries(
        Object.entries(s.buttons).filter(([k]) => !k.startsWith(prefix + ':')),
      )
      return { buttons: { ...filtered, ...updates } }
    })
  },

  // ─── Session Status ────────────────────────────────────────────────────────
  sessionStatus: {},

  applySessionStatus: (msg) => {
    // Key ist jetzt hostId (nicht mehr hostId:page)
    set((s) => ({ sessionStatus: { ...s.sessionStatus, [msg.hostId]: msg.status } }))
  },

  markAllSessionsStale: () =>
    set((s) => ({
      sessionStatus: Object.fromEntries(
        Object.keys(s.sessionStatus).map((k) => [k, 'stale' as SessionStatus]),
      ),
      virtualSessionStatus: Object.fromEntries(
        Object.keys(s.virtualSessionStatus).map((k) => [k, 'stale' as const]),
      ),
    })),

  // ─── Host Info ────────────────────────────────────────────────────────────
  hostInfo: {},

  applyHostInfo: (msg) =>
    set((s) => ({
      hostInfo: {
        ...s.hostInfo,
        [msg.hostId]: { companionVersion: msg.companionVersion, apiVersion: msg.apiVersion },
      },
    })),

  // ─── Virtual Deck ─────────────────────────────────────────────────────────
  virtualKeys: {},

  applyVDelta: (msg) => {
    set((s) => {
      const deviceKeys = s.virtualKeys[msg.deviceId] ?? {}
      const keyStr = String(msg.keyIndex)
      return {
        virtualKeys: {
          ...s.virtualKeys,
          [msg.deviceId]: {
            ...deviceKeys,
            [keyStr]: {
              ...deviceKeys[keyStr],
              ...(msg.bgColor !== undefined && { bgColor: msg.bgColor }),
              ...(msg.textColor !== undefined && { textColor: msg.textColor }),
              ...(msg.text !== undefined && { text: msg.text }),
              ...(msg.bitmap !== undefined && { bitmap: msg.bitmap }),
            },
          },
        },
      }
    })
  },

  applyVSnapshot: (msg) => {
    set((s) => ({
      virtualKeys: {
        ...s.virtualKeys,
        [msg.deviceId]: msg.keys as Record<string, KeyState>,
      },
    }))
  },

  getVirtualKeyState: (deviceId, keyIndex) => {
    return get().virtualKeys[deviceId]?.[String(keyIndex)]
  },

  virtualSessionStatus: {},

  applyVSessionStatus: (msg) => {
    set((s) => ({
      virtualSessionStatus: { ...s.virtualSessionStatus, [msg.deviceId]: msg.status },
    }))
  },

  getVirtualSessionStatus: (deviceId) => {
    return get().virtualSessionStatus[deviceId]
  },

  // ─── Host CRUD ────────────────────────────────────────────────────────────
  addHost: (host) =>
    set((s) => {
      if (!s.settings) return s
      return { settings: { ...s.settings, hosts: [...s.settings.hosts, host] } }
    }),

  updateHost: (host) =>
    set((s) => {
      if (!s.settings) return s
      return {
        settings: {
          ...s.settings,
          hosts: s.settings.hosts.map((h) => (h.id === host.id ? host : h)),
        },
      }
    }),

  removeHost: (hostId, deleteRefs) =>
    set((s) => {
      if (!s.settings) return s
      const hosts = s.settings.hosts.filter((h) => h.id !== hostId)
      const panels = deleteRefs
        ? s.settings.panels.map((p) => ({
            ...p,
            elements: p.elements.filter(
              (el) => !(el.type === 'companionButton' && (el as any).ref?.hostId === hostId),
            ),
          }))
        : s.settings.panels
      return { settings: { ...s.settings, hosts, panels } }
    }),

  // ─── Panel CRUD ───────────────────────────────────────────────────────────
  createPanel: (name) => {
    const panel: Panel = {
      id: crypto.randomUUID(),
      name,
      zoom: 1,
      defaultMode: 'view',
      grid: { enabled: true, size: 40, snap: true },
      canvas: { width: 1920, height: 1080, background: '#0f141a' },
      elements: [],
    }
    set((s) => {
      if (!s.settings) return s
      return {
        settings: { ...s.settings, panels: [...s.settings.panels, panel] },
        activePanelId: panel.id,
      }
    })
    return panel
  },

  renamePanel: (panelId, name) =>
    set((s) => {
      if (!s.settings) return s
      return {
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) => p.id === panelId ? { ...p, name } : p),
        },
      }
    }),

  deletePanel: (panelId) => {
    const { settings, activePanelId } = get()
    if (!settings || settings.panels.length <= 1) return false
    const remaining = settings.panels.filter((p) => p.id !== panelId)
    const nextActive = activePanelId === panelId ? (remaining[0]?.id ?? null) : activePanelId
    set({ settings: { ...settings, panels: remaining }, activePanelId: nextActive })
    return true
  },

  setZoom: (panelId, zoom) =>
    set((s) => {
      if (!s.settings) return s
      const clamped = Math.max(0.2, Math.min(2.0, zoom))
      return {
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId ? p : { ...p, zoom: clamped },
          ),
        },
      }
    }),

  duplicatePanel: (panelId) => {
    const { settings } = get()
    if (!settings) return null as unknown as Panel
    const source = settings.panels.find((p) => p.id === panelId)
    if (!source) return null as unknown as Panel
    const newPanel: Panel = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} Copy`,
      elements: source.elements.map((el) => ({ ...el, id: crypto.randomUUID() })),
    }
    set((s) => ({
      settings: { ...s.settings!, panels: [...s.settings!.panels, newPanel] },
      activePanelId: newPanel.id,
    }))
    return newPanel
  },

  copyElementsToPanel: (sourcePanelId, targetPanelId, elementIds) => {
    const { settings } = get()
    if (!settings) return
    const sourcePanel = settings.panels.find((p) => p.id === sourcePanelId)
    if (!sourcePanel) return
    const copies = sourcePanel.elements
      .filter((el) => elementIds.includes(el.id))
      .map((el) => ({ ...el, id: crypto.randomUUID(), x: el.x + 75, y: el.y + 75 }))
    set((s) => ({
      settings: {
        ...s.settings!,
        panels: s.settings!.panels.map((p) =>
          p.id !== targetPanelId ? p : { ...p, elements: [...p.elements, ...copies] },
        ),
      },
    }))
  },

  // ─── Edit Mode ────────────────────────────────────────────────────────────
  selectedIds: new Set<string>(),

  selectElement: (id, addToSelection) =>
    set((s) => {
      const next = new Set(addToSelection ? s.selectedIds : [])
      if (addToSelection && s.selectedIds.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { selectedIds: next }
    }),

  selectElements: (ids) => set({ selectedIds: new Set(ids) }),

  clearSelection: () => set({ selectedIds: new Set() }),

  updateElementGeometry: (panelId, elementId, patch) =>
    set((s) => {
      if (!s.settings) return s
      return {
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId
              ? p
              : {
                  ...p,
                  elements: p.elements.map((el) =>
                    el.id !== elementId ? el : { ...el, ...patch },
                  ),
                },
          ),
        },
      }
    }),

  updateElement: (panelId, elementId, patch) =>
    set((s) => {
      if (!s.settings) return s
      return {
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId
              ? p
              : {
                  ...p,
                  elements: p.elements.map((el) =>
                    el.id !== elementId ? el : { ...el, ...patch } as AnyElement,
                  ),
                },
          ),
        },
      }
    }),

  _undoSnapshot: null,
  _redoSnapshot: null,

  saveUndoSnapshot: (elementIds) =>
    set((s) => {
      if (!s.settings) return s
      const snapshot: Record<string, { x: number; y: number; w: number; h: number; panelId: string }> = {}
      for (const panel of s.settings.panels) {
        for (const el of panel.elements) {
          if (elementIds.includes(el.id)) {
            snapshot[el.id] = { x: el.x, y: el.y, w: el.w, h: el.h, panelId: panel.id }
          }
        }
      }
      return { _undoSnapshot: snapshot, _redoSnapshot: null } as any
    }),

  undo: () =>
    set((s: any) => {
      const snap = s._undoSnapshot
      if (!s.settings || !snap) return s
      const redoSnap: typeof snap = {}
      for (const panel of s.settings.panels) {
        for (const el of panel.elements) {
          if (snap[el.id]) {
            redoSnap[el.id] = { x: el.x, y: el.y, w: el.w, h: el.h, panelId: panel.id }
          }
        }
      }
      return {
        _redoSnapshot: redoSnap,
        _undoSnapshot: null,
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p: any) => ({
            ...p,
            elements: p.elements.map((el: any) =>
              snap[el.id]
                ? { ...el, x: snap[el.id].x, y: snap[el.id].y, w: snap[el.id].w, h: snap[el.id].h }
                : el,
            ),
          })),
        },
      }
    }),

  redo: () =>
    set((s: any) => {
      const snap = s._redoSnapshot
      if (!s.settings || !snap) return s
      return {
        _undoSnapshot: null,
        _redoSnapshot: null,
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p: any) => ({
            ...p,
            elements: p.elements.map((el: any) =>
              snap[el.id]
                ? { ...el, x: snap[el.id].x, y: snap[el.id].y, w: snap[el.id].w, h: snap[el.id].h }
                : el,
            ),
          })),
        },
      }
    }),

  duplicateElements: (panelId, ids) =>
    set((s) => {
      if (!s.settings) return s
      const newIds: string[] = []
      const panels = s.settings.panels.map((p) => {
        if (p.id !== panelId) return p
        const copies: typeof p.elements = []
        for (const el of p.elements) {
          if (ids.includes(el.id)) {
            const copy = { ...el, id: crypto.randomUUID(), x: el.x + 75, y: el.y + 75 }
            copies.push(copy)
            newIds.push(copy.id)
          }
        }
        return { ...p, elements: [...p.elements, ...copies] }
      })
      return { settings: { ...s.settings, panels }, selectedIds: new Set(newIds) }
    }),

  deleteElements: (panelId, ids) =>
    set((s) => {
      if (!s.settings) return s
      return {
        selectedIds: new Set(),
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId
              ? p
              : { ...p, elements: p.elements.filter((el) => !ids.includes(el.id)) },
          ),
        },
      }
    }),

  addElement: (panelId, element) =>
    set((s) => {
      if (!s.settings) return s
      const existingElements = s.settings.panels.find((p) => p.id === panelId)?.elements ?? []
      const withZ = element.z < 0
        ? { ...element, z: Math.max(0, existingElements.reduce((m, e) => Math.min(m, e.z ?? 0), 0) - 1) }
        : { ...element, z: (existingElements.reduce((m, e) => Math.max(m, e.z ?? 0), 0) + 1) }
      return {
        selectedIds: new Set([element.id]),
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId ? p : { ...p, elements: [...p.elements, withZ] },
          ),
        },
      }
    }),

  // ─── Edit UI State ────────────────────────────────────────────────────────
  showHostLabels: false,
  setShowHostLabels: (v) => set({ showHostLabels: v }),

  // ─── Layer System ─────────────────────────────────────────────────────────
  moveToLayer: (panelId, elementIds, layer) =>
    set((s) => {
      if (!s.settings) return s
      const idSet = new Set(elementIds)
      return {
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId ? p : {
              ...p,
              elements: p.elements.map((el) =>
                idSet.has(el.id) ? { ...el, layer } : el,
              ),
            },
          ),
        },
      }
    }),

  bringForward: (panelId, elementId) =>
    set((s) => {
      if (!s.settings) return s
      const panel = s.settings.panels.find((p) => p.id === panelId)
      if (!panel) return s
      const el = panel.elements.find((e) => e.id === elementId)
      if (!el) return s
      const elLayer = el.layer ?? defaultLayerFor(el.type)
      const currentZ = el.z ?? 0
      // Only swap with elements in the same layer
      const above = panel.elements
        .filter((e) => e.id !== elementId && (e.layer ?? defaultLayerFor(e.type)) === elLayer && (e.z ?? 0) > currentZ)
        .sort((a, b) => (a.z ?? 0) - (b.z ?? 0))[0]
      if (!above) return s
      const aboveZ = above.z ?? 0
      return {
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId ? p : {
              ...p,
              elements: p.elements.map((e) => {
                if (e.id === elementId) return { ...e, z: aboveZ }
                if (e.id === above.id) return { ...e, z: currentZ }
                return e
              }),
            },
          ),
        },
      }
    }),

  sendBackward: (panelId, elementId) =>
    set((s) => {
      if (!s.settings) return s
      const panel = s.settings.panels.find((p) => p.id === panelId)
      if (!panel) return s
      const el = panel.elements.find((e) => e.id === elementId)
      if (!el) return s
      const elLayer = el.layer ?? defaultLayerFor(el.type)
      const currentZ = el.z ?? 0
      // Only swap with elements in the same layer
      const below = panel.elements
        .filter((e) => e.id !== elementId && (e.layer ?? defaultLayerFor(e.type)) === elLayer && (e.z ?? 0) < currentZ)
        .sort((a, b) => (b.z ?? 0) - (a.z ?? 0))[0]
      if (!below) return s
      const belowZ = below.z ?? 0
      return {
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId ? p : {
              ...p,
              elements: p.elements.map((e) => {
                if (e.id === elementId) return { ...e, z: belowZ }
                if (e.id === below.id) return { ...e, z: currentZ }
                return e
              }),
            },
          ),
        },
      }
    }),

  // ─── Style Copy/Paste ─────────────────────────────────────────────────────
  copiedStyle: null,

  copyElementStyle: (panelId, elementId) => {
    const panel = get().settings?.panels.find((p) => p.id === panelId)
    const el = panel?.elements.find((e) => e.id === elementId)
    if (!el) return
    let payload: Record<string, unknown> = {}
    if (el.type === 'companionButton' || el.type === 'virtualCompanionDeck') {
      payload = { ...(el as any).render }
    } else {
      payload = { ...(el as any).style }
    }
    set({ copiedStyle: { type: el.type, w: el.w, h: el.h, payload } })
  },

  pasteElementStyle: (panelId, targetIds) => {
    const { copiedStyle, settings } = get()
    if (!copiedStyle || !settings) return
    const panel = settings.panels.find((p) => p.id === panelId)
    if (!panel) return
    const updates: Record<string, Partial<AnyElement>> = {}
    for (const id of targetIds) {
      const el = panel.elements.find((e) => e.id === id)
      if (!el || el.type !== copiedStyle.type) continue
      const patch: Record<string, unknown> = { w: copiedStyle.w, h: copiedStyle.h }
      if (el.type === 'companionButton' || el.type === 'virtualCompanionDeck') {
        patch.render = { ...(el as any).render, ...copiedStyle.payload }
      } else {
        patch.style = { ...(el as any).style, ...copiedStyle.payload }
      }
      updates[id] = patch as Partial<AnyElement>
    }
    set((s) => {
      if (!s.settings) return s
      return {
        settings: {
          ...s.settings,
          panels: s.settings.panels.map((p) =>
            p.id !== panelId ? p : {
              ...p,
              elements: p.elements.map((el) =>
                updates[el.id] ? { ...el, ...updates[el.id] } as AnyElement : el,
              ),
            },
          ),
        },
      }
    })
  },

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getButtonState: (hostId, page, row, col) =>
    get().buttons[`${pageKey(hostId, page)}:${row}:${col}`],

  getSessionStatus: (hostId) =>
    get().sessionStatus[hostId],

  hostExists: (hostId) =>
    (get().settings?.hosts ?? []).some((h) => h.id === hostId),
}))
