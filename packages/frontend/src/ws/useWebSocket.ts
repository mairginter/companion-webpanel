import { useEffect, useRef, useCallback } from 'react'
import { BackendToFrontend, FrontendToBackend } from '@cwp/shared'
import { useAppStore } from '../store/useAppStore.js'

const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:8080`
  : `ws://${window.location.host}`

const RECONNECT_DELAY_MS = 2000

/**
 * Verbindet zum Backend-WebSocket, verarbeitet Nachrichten und füllt den Zustand-Store.
 * Reconnect bei Verbindungsabbruch.
 */
export function useWebSocket(): {
  sendPress: (hostId: string, page: number, row: number, col: number, pressed: boolean) => void
  sendRotate: (hostId: string, page: number, row: number, col: number, direction: 1 | -1) => void
  sendVPress: (deviceId: string, keyIndex: number, pressed: boolean) => void
} {
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const applyDelta = useAppStore((s) => s.applyDelta)
  const applySnapshot = useAppStore((s) => s.applySnapshot)
  const applySessionStatus = useAppStore((s) => s.applySessionStatus)
  const applyHostInfo = useAppStore((s) => s.applyHostInfo)
  const markAllSessionsStale = useAppStore((s) => s.markAllSessionsStale)
  const applyVDelta = useAppStore((s) => s.applyVDelta)
  const applyVSnapshot = useAppStore((s) => s.applyVSnapshot)
  const applyVSessionStatus = useAppStore((s) => s.applyVSessionStatus)

  const connect = useCallback(() => {
    // Nicht verbinden wenn bereits offen oder am verbinden
    const state = ws.current?.readyState
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return

    const socket = new WebSocket(WS_URL)
    ws.current = socket

    socket.onopen = () => {
      console.log('[WS] Verbunden mit Backend')
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as BackendToFrontend
        switch (msg.t) {
          case 'delta':
            applyDelta(msg)
            break
          case 'snapshot':
            applySnapshot(msg)
            break
          case 'sessionStatus':
            applySessionStatus(msg)
            break
          case 'hostInfo':
            applyHostInfo(msg)
            break
          case 'vDelta':
            applyVDelta(msg)
            break
          case 'vSnapshot':
            applyVSnapshot(msg)
            break
          case 'vSessionStatus':
            applyVSessionStatus(msg)
            break
        }
      } catch {
        console.warn('[WS] Ungültige Nachricht vom Backend')
      }
    }

    socket.onclose = () => {
      console.log('[WS] Verbindung getrennt — reconnect in', RECONNECT_DELAY_MS, 'ms')
      // Nur null setzen wenn diese Socket noch die aktuelle ist
      if (ws.current === socket) {
        ws.current = null
        // Alle Sessions als stale markieren — zeigt ⚠ auf Buttons bis reconnect
        markAllSessionsStale()
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    socket.onerror = (err) => {
      console.error('[WS] Fehler:', err)
    }
  }, [applyDelta, applySnapshot, applySessionStatus, applyHostInfo, markAllSessionsStale, applyVDelta, applyVSnapshot, applyVSessionStatus])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  const sendPress = useCallback(
    (hostId: string, page: number, row: number, col: number, pressed: boolean) => {
      if (ws.current?.readyState !== WebSocket.OPEN) return
      const msg: FrontendToBackend = { t: 'press', hostId, page, row, col, pressed }
      ws.current.send(JSON.stringify(msg))
    },
    [],
  )

  const sendRotate = useCallback(
    (hostId: string, page: number, row: number, col: number, direction: 1 | -1) => {
      if (ws.current?.readyState !== WebSocket.OPEN) return
      const msg: FrontendToBackend = { t: 'rotate', hostId, page, row, col, direction }
      ws.current.send(JSON.stringify(msg))
    },
    [],
  )

  const sendVPress = useCallback(
    (deviceId: string, keyIndex: number, pressed: boolean) => {
      if (ws.current?.readyState !== WebSocket.OPEN) return
      const msg: FrontendToBackend = { t: 'vPress', deviceId, keyIndex, pressed }
      ws.current.send(JSON.stringify(msg))
    },
    [],
  )

  return { sendPress, sendRotate, sendVPress }
}
