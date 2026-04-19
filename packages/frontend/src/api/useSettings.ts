/**
 * useSettings.ts
 *
 * React-Hook für das Laden und Speichern der Webpanel-Settings über die Backend-HTTP-API.
 *
 * Aufgaben:
 *  - Beim App-Start: GET /api/settings → Settings in den Zustand-Store laden
 *  - saveSettings(): POST /api/settings → geänderte Settings ans Backend senden,
 *    das sie atomar in die JSON-Datei schreibt
 *  - saveSettings() aktualisiert auch den lokalen Store sofort (optimistic update),
 *    damit die UI ohne Wartezeit reagiert
 */
import { useEffect, useCallback } from 'react'
import { Settings } from '@cwp/shared'
import { useAppStore } from '../store/useAppStore'
import i18n from '../i18n'

const SETTINGS_URL = import.meta.env.DEV
  ? 'http://localhost:8080/api/settings'
  : '/api/settings'

export function useSettings(): { saveSettings: (s: Settings) => Promise<void> } {
  const setSettings = useAppStore((s) => s.setSettings)

  useEffect(() => {
    fetch(SETTINGS_URL)
      .then((r) => r.json())
      .then((data: Settings) => {
        setSettings(data)
        // Apply global language from settings only if no per-device override exists
        if (data.language && !localStorage.getItem('cwp-language')) {
          void i18n.changeLanguage(data.language)
        }
      })
      .catch((err) => console.error('[Settings] Fehler beim Laden:', err))
  }, [setSettings])

  const saveSettings = useCallback(async (updated: Settings): Promise<void> => {
    // Optimistic update: Store sofort aktualisieren damit die UI nicht wartet
    setSettings(updated)

    try {
      const res = await fetch(SETTINGS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        console.error('[Settings] Fehler beim Speichern:', err)
        throw new Error(err.error ?? 'Unbekannter Fehler')
      }
    } catch (err) {
      console.error('[Settings] Netzwerkfehler beim Speichern:', err)
      throw err
    }
  }, [setSettings])

  return { saveSettings }
}
