import './i18n'
// Material Icons selbst hosten (Offline-fähige PWA) — nur Filled-Variante,
// Vite bundled die woff2 automatisch als Asset.
import 'material-icons/iconfont/filled.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'

const root = document.getElementById('root')
if (!root) throw new Error('#root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
