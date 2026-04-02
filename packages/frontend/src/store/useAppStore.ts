import { create } from 'zustand'
import {
  KeyState,
  Settings,
  Panel,
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
  /** key: "hostId:page:keyIndex" → KeyState */
  buttons: Record<string, KeyState>
  applyDelta: (msg: DeltaMessage) => void
  applySnapshot: (msg: SnapshotMessage) => void

  // ─── Session Status ───────────────────────────────────────────────────────
  /** key: "hostId:page" → status */
  sessionStatus: Record<string, SessionStatus>
  applySessionStatus: (msg: SessionStatusMessage) => void

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getButtonState: (hostId: string, page: number, keyIndex: number) => KeyState | undefined
  getSessionStatus: (hostId: string, page: number) => SessionStatus | undefined
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
    const k = `${pageKey(msg.hostId, msg.page)}:${msg.key}`
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
    const prefix = pageKey(msg.hostId, msg.page)
    const updates: Record<string, KeyState> = {}
    for (const [idx, state] of Object.entries(msg.keys)) {
      updates[`${prefix}:${idx}`] = state
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
    const k = pageKey(msg.hostId, msg.page)
    set((s) => ({ sessionStatus: { ...s.sessionStatus, [k]: msg.status } }))
  },

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getButtonState: (hostId, page, keyIndex) =>
    get().buttons[`${pageKey(hostId, page)}:${keyIndex}`],

  getSessionStatus: (hostId, page) =>
    get().sessionStatus[pageKey(hostId, page)],
}))
