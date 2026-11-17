/**
 * useSettings.ts
 *
 * Lädt und speichert die Settings über die Backend-HTTP-API (/api/settings).
 *
 *  - useSettings()     Hook: lädt beim Mount, liefert saveSettings()
 *  - reloadSettings()  Modul-Funktion: lädt den Server-Stand neu (verwirft lokale Änderungen) —
 *                      wird vom WS-Hook genutzt wenn ein ANDERES Gerät gespeichert hat
 *  - CLIENT_ID         zufällige ID dieses Browser-Tabs; wird beim POST mitgeschickt, damit
 *                      der eigene settingsChanged-Broadcast ignoriert werden kann
 *
 * Dirty-Tracking: nach Laden und nach erfolgreichem Speichern wird der Stand per
 * store.markSaved() als "gespeichert" markiert (siehe selectDirty im Store).
 * Speicherfehler erscheinen als Toast — vorher landeten sie nur in der Konsole.
 */
import { useEffect, useCallback } from 'react'
import type { Settings } from '@cwp/shared'
import { useAppStore } from '../store/useAppStore'
import i18n, { getStoredLanguage } from '../i18n'

const SETTINGS_URL = import.meta.env.DEV
  ? 'http://localhost:8080/api/settings'
  : '/api/settings'

/** Eindeutige ID dieses Browser-Tabs (pro Seitenaufruf neu) */
export const CLIENT_ID = Math.random().toString(36).slice(2, 12)

/**
 * Lädt den aktuellen Server-Stand und ersetzt die Settings im Store.
 * Lokale ungespeicherte Änderungen gehen dabei verloren — Aufrufer entscheidet.
 */
export async function reloadSettings(): Promise<boolean> {
  try {
    const res = await fetch(SETTINGS_URL)
    const data = (await res.json()) as Settings
    const store = useAppStore.getState()
    store.setSettings(data)
    store.markSaved(data)
    // Selektion könnte auf inzwischen gelöschte Elemente zeigen
    store.clearSelection()
    return true
  } catch (err) {
    console.error('[Settings] Fehler beim Laden:', err)
    return false
  }
}

export function useSettings(): { saveSettings: (s: Settings) => Promise<boolean> } {
  const setSettings = useAppStore((s) => s.setSettings)

  useEffect(() => {
    void reloadSettings().then((ok) => {
      if (!ok) return
      // Globale Sprach-Vorgabe aus den Settings nur anwenden, wenn dieses Gerät
      // keine eigene Sprache gewählt hat (Sprachauswahl oder ?lang=)
      const data = useAppStore.getState().settings
      if (data?.language && !getStoredLanguage()) {
        void i18n.changeLanguage(data.language)
      }
    })
  }, [])

  /**
   * Speichert die Settings. Liefert true bei Erfolg, false bei Fehler (wirft nicht —
   * die meisten Aufrufer sind fire-and-forget; der Fehler wird als Toast angezeigt).
   */
  const saveSettings = useCallback(async (updated: Settings): Promise<boolean> => {
    // Optimistic update: Store sofort aktualisieren damit die UI nicht wartet
    setSettings(updated)

    try {
      const res = await fetch(`${SETTINGS_URL}?client=${CLIENT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error ?? res.statusText)
      }
      // Nur als gespeichert markieren wenn seit dem Absenden nichts weiter geändert wurde —
      // sonst bliebe eine zwischenzeitliche Änderung fälschlich "sauber".
      const store = useAppStore.getState()
      if (store.settings === updated) store.markSaved(updated)
      // Stehengebliebene Fehler-/Konflikt-Toasts sind nach erfolgreichem Speichern überholt
      if (store.toast?.sticky) store.clearToast()
      return true
    } catch (err) {
      console.error('[Settings] Fehler beim Speichern:', err)
      const detail = err instanceof Error ? err.message : String(err)
      useAppStore.getState().showToast({
        kind: 'error',
        text: `${i18n.t('toast.saveFailed')}: ${detail}`,
        sticky: true,
      })
      return false
    }
  }, [setSettings])

  return { saveSettings }
}
