/**
 * metaConfig.ts — Machine-local meta configuration
 *
 * Stores machine-specific data that must NOT be synced to cloud.
 * Currently: the path to the active settings file (custom or default).
 *
 * Path: userData/meta.json
 * Format: { settingsPath?: string }  (normalized with ~, expanded on read)
 */
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface MetaConfig {
  /** ~-normalized path to the active settings file. Machine-specific. */
  settingsPath?: string
}

/** Replaces os.homedir() prefix with ~ for portable storage. */
export function normalizePath(abs: string): string {
  const home = os.homedir()
  if (abs.startsWith(home + path.sep) || abs === home) {
    return '~' + abs.slice(home.length)
  }
  return abs
}

/** Expands leading ~ back to os.homedir(). */
export function expandPath(norm: string): string {
  if (norm === '~') return os.homedir()
  if (norm.startsWith('~' + path.sep) || norm.startsWith('~/')) {
    return path.join(os.homedir(), norm.slice(2))
  }
  return norm
}

function metaPath(userDataPath: string): string {
  return path.join(userDataPath, 'meta.json')
}

/** Loads meta config from userData/meta.json. Returns {} if file missing or malformed. */
export function loadMeta(userDataPath: string): MetaConfig {
  const p = metaPath(userDataPath)
  if (!fs.existsSync(p)) return {}
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as MetaConfig
  } catch {
    return {}
  }
}

/** Saves meta config to userData/meta.json. */
export function saveMeta(userDataPath: string, meta: MetaConfig): void {
  fs.mkdirSync(userDataPath, { recursive: true })
  fs.writeFileSync(metaPath(userDataPath), JSON.stringify(meta, null, 2), 'utf8')
}
