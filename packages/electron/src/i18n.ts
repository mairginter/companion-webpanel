/**
 * i18n.ts — i18next für den Electron Main-Prozess
 *
 * Lädt dieselben Locale-Dateien wie das Frontend aus @cwp/shared/locales/.
 * Muss via initElectronI18n(lang) aufgerufen werden bevor Tray und Startup-Fenster
 * gebaut werden.
 */
import i18next from 'i18next'
import de from '../../shared/locales/de.json'
import en from '../../shared/locales/en.json'

let initialised = false

export async function initElectronI18n(lang: string): Promise<void> {
  if (initialised) {
    await i18next.changeLanguage(lang)
    return
  }
  await i18next.init({
    lng: lang,
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    fallbackLng: 'de',
    interpolation: { escapeValue: false },
  })
  initialised = true
}

export function t(key: string, options?: Record<string, unknown>): string {
  return i18next.t(key, options ?? {}) as string
}
