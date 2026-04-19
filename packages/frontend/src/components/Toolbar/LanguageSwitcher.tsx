/**
 * LanguageSwitcher.tsx
 *
 * Kleines Dropdown in der Toolbar zum Wechseln der Anzeigesprache.
 * Schreibt die Wahl in localStorage ('cwp-language') und ruft i18n.changeLanguage() auf.
 * Nur sichtbar wenn mehr als eine Sprache verfügbar ist.
 */
import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const LANG_LABELS: Record<string, string> = {
  de: '🇩🇪 DE',
  en: '🇬🇧 EN',
}

const btnStyle: React.CSSProperties = {
  padding: '0 8px',
  height: 32,
  borderRadius: 6,
  border: '1px solid #2a3344',
  background: '#1a2030',
  color: '#8896aa',
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
  transition: 'all 0.15s',
}

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const available = Object.keys(i18n.options.resources ?? {})
  // Only render when more than one language is available
  if (available.length <= 1) return null

  const current = i18n.resolvedLanguage ?? i18n.language

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        style={btnStyle}
        onClick={() => setOpen((o) => !o)}
        title={t('toolbar.language')}
      >
        🌐 {current.toUpperCase()} {open ? '▲' : '▾'}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          background: '#1a2030',
          border: '1px solid #2a3344',
          borderRadius: 6,
          minWidth: 110,
          zIndex: 500,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {available.map((lang) => (
            <div
              key={lang}
              onClick={() => {
                i18n.changeLanguage(lang)
                localStorage.setItem('cwp-language', lang)
                setOpen(false)
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 13,
                color: lang === current ? '#4a9eff' : '#e9edf2',
                background: lang === current ? 'rgba(74,158,255,0.08)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ width: 12, flexShrink: 0 }}>
                {lang === current ? '✓' : ''}
              </span>
              {LANG_LABELS[lang] ?? lang.toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
