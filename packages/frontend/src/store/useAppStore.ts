import { create } from 'zustand'
import {
  KeyState,
  Settings,
  Panel,
  AnyElement,
  DeltaMessage,
  SnapshotMessage,
  SessionStatusMessage,
  pageKey,
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

  _undoSnapshot: Record<string, { x: number; y: number; w: number; h: number; panelId: string }> | null
  _redoSnapshot: Record<string, { x: number; y: number; w: number; h: number; panelId: string }> | null
  saveUndoSnapshot: (elementIds: string[]) => void
  undo: () => void
  redo: () => void

  duplicateElements: (panelId: string, ids: string[]) => void
  deleteElements: (panelId: string, ids: string[]) => void
  addElement: (panelId: string, element: AnyElement) => void

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getButtonState: (hostId: string, page: number, row: number, col: number) => KeyState | undefined
  /** Verbindungsstatus eines Hosts (kein page-Parameter mehr nötig) */
  getSessionStatus: (hostId: string) => SessionStatus | undefined
}

export const useAppStore = create<AppStore>((set, get) => ({
  // ─── Settings ─────────────────────────────────────────────────────────────
  settings: null,
  activePanelId: null,

  setSettings: (settings) => {
    const activePanelId = settings.panels[0]?.id ?? null
    set({ settings, activePanelId })
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
    })),

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

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getButtonState: (hostId, page, row, col) =>
    get().buttons[`${pageKey(hostId, page)}:${row}:${col}`],

  getSessionStatus: (hostId) =>
    get().sessionStatus[hostId],
}))
