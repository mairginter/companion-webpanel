/**
 * i18n.ts
 *
 * Initialisiert react-i18next für das Companion Webpanel Frontend.
 *
 * Sprach-Priorität (höchste zuerst):
 *  1. URL-Parameter ?lang=de|en        — wird als Geräte-Wahl übernommen (siehe unten)
 *  2. localStorage 'cwp-lang'          — Geräte-Wahl, gesetzt über die Sprachauswahl
 *  3. Settings.language                — globale Vorgabe, angewendet in useSettings.ts
 *  4. Default: 'en' (Englisch)
 *
 * Bewusst KEINE Erkennung der Browser-Sprache mehr und kein automatisches Cachen:
 * Früher schrieb der Detector die erkannte Browser-Sprache sofort in den localStorage —
 * dadurch sah jede automatische Erkennung wie eine bewusste Wahl aus und die globale
 * Vorgabe Settings.language griff nie. Jetzt landet nur eine ausdrückliche Wahl
 * (Sprachauswahl oder ?lang=) im localStorage.
 *
 * Der Key heißt absichtlich 'cwp-lang' statt früher 'cwp-language': Unter dem alten Key
 * liegen auf bestehenden Geräten automatisch erkannte Werte, die nicht von einer echten
 * Wahl unterscheidbar sind.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from '../../shared/locales/de.json'
import en from '../../shared/locales/en.json'

/** localStorage-Key für die ausdrücklich gewählte Sprache dieses Geräts */
export const LANG_STORAGE_KEY = 'cwp-lang'

/** Verfügbare Sprachen (Reihenfolge = Reihenfolge in Auswahllisten) */
export const AVAILABLE_LANGUAGES = ['en', 'de'] as const

export const DEFAULT_LANGUAGE = 'en'

function isAvailable(lang: string | null | undefined): lang is string {
  return !!lang && (AVAILABLE_LANGUAGES as readonly string[]).includes(lang)
}

/** Ausdrücklich gewählte Sprache dieses Geräts (oder null). */
export function getStoredLanguage(): string | null {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY)
    return isAvailable(v) ? v : null
  } catch {
    return null
  }
}

/** Sprache wechseln UND als Geräte-Wahl merken. */
export function setDeviceLanguage(lang: string): void {
  if (!isAvailable(lang)) return
  try { localStorage.setItem(LANG_STORAGE_KEY, lang) } catch { /* Storage nicht verfügbar */ }
  void i18n.changeLanguage(lang)
}

/**
 * Start-Sprache bestimmen. Ein gültiger ?lang=-Parameter wird sofort als Geräte-Wahl
 * gespeichert — so legt ein Geräte-Link (oder das Electron-Startfenster) die Sprache fest.
 */
function initialLanguage(): string {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang')?.trim().toLowerCase()
    if (isAvailable(fromUrl)) {
      try { localStorage.setItem(LANG_STORAGE_KEY, fromUrl) } catch { /* ignorieren */ }
      // Parameter wieder aus der Adresse nehmen: Die Wahl steht jetzt im localStorage.
      // Bliebe er stehen, würde er nach einem Reload eine spätere Wahl über die
      // Sprachauswahl wieder überschreiben.
      try {
        const url = new URL(window.location.href)
        url.searchParams.delete('lang')
        window.history.replaceState(window.history.state, '', url)
      } catch { /* z.B. file://-Kontext */ }
      return fromUrl
    }
  } catch { /* kein window.location (Tests) */ }
  return getStoredLanguage() ?? DEFAULT_LANGUAGE
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    lng: initialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
  })

export default i18n
