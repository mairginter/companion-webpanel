// build.mjs — esbuild bundler für Electron main + preload
// Kopiert auch das fertig gebaute Frontend in dist/frontend/
import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')

const sharedConfig = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  external: ['electron'],  // electron ist immer extern (vom Runtime geliefert)
  sourcemap: true,
}

// Main process bundle (enthält backend-Code direkt)
await esbuild.build({
  ...sharedConfig,
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  // @cwp/* über relative Pfade auflösen
  alias: {
    '@cwp/shared': path.join(root, 'packages/shared/src/types.ts'),
    '@cwp/backend': path.join(root, 'packages/backend/src/index.ts'),
  },
})

// Preload script (separates Bundle, kein Zugriff auf Backend-Code)
await esbuild.build({
  ...sharedConfig,
  entryPoints: ['src/preload.ts'],
  outfile: 'dist/preload.js',
})

// Frontend dist in packages/electron/frontend/ kopieren (für Packaging)
const frontendSrc = path.join(root, 'packages/frontend/dist')
const frontendDst = path.join(__dirname, 'frontend')

if (fs.existsSync(frontendSrc)) {
  fs.rmSync(frontendDst, { recursive: true, force: true })
  fs.cpSync(frontendSrc, frontendDst, { recursive: true })
  console.log('Frontend dist kopiert → packages/electron/frontend/')
} else {
  console.warn('WARNUNG: packages/frontend/dist nicht gefunden — zuerst npm run build -w @cwp/frontend ausführen')
}

console.log('Electron build complete.')
