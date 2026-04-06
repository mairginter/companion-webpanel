/**
 * launch-electron.mjs — Startet Electron mit bereinigter Umgebung
 *
 * Manche Entwicklungstools (Claude Code, VS Code Terminal) setzen
 * ELECTRON_RUN_AS_NODE=1, was Electron's GUI-Initialisierung verhindert.
 * Dieses Script entfernt die Variable bevor electron.exe gestartet wird.
 */
import { spawn } from 'child_process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const electronPath = require('electron')

// Umgebungsvariable entfernen die Electron in reinen Node-Modus zwingt
delete process.env.ELECTRON_RUN_AS_NODE

const child = spawn(electronPath, ['packages/electron'], {
  stdio: 'inherit',
  env: process.env,
})

child.on('close', (code) => process.exit(code ?? 0))
