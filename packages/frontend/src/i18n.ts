/**
 * i18n.ts
 *
 * Initialisiert react-i18next für das Companion Webpanel Frontend.
 *
 * Sprach-Priorität:
 *  1. localStorage 'cwp-language' (per-Gerät Override, gesetzt via Sprachauswahl-UI)
 *  2. Browser-Sprache (navigator.language)
 *  3. Fallback: 'de' (Deutsch)
 *
 * Die globale Einstellung Settings.language wird in useSettings.ts angewendet,
 * aber nur wenn kein per-Gerät Override im localStorage vorhanden ist.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import de from '../../shared/locales/de.json'
import en from '../../shared/locales/en.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'cwp-language',
    },
    fallbackLng: 'de',
    interpolation: { escapeValue: false },
  })

export default i18n
