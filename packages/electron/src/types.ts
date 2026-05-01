/**
 * types.ts — Electron-interne Typen
 *
 * AppStatus: IPC-Payload vom Main Process an den Startup-Renderer.
 * Wird über contextBridge als window.cwpApi.getStatus() zurückgegeben
 * und als 'status-update' Event gepusht.
 */

export interface HostStatus {
  id: string
  name: string
  status: 'connecting' | 'connected' | 'stale' | 'error' | 'caps-disabled'
}

export interface AppStatus {
  /** Tatsächlich verwendeter Port (kann vom konfigurierten abweichen) */
  port: number
  /** true wenn Port automatisch gewählt wurde (konfigurierter war belegt) */
  portAuto: boolean
  /** Status pro Host */
  hosts: HostStatus[]
  /** true wenn die konfigurierte Settings-Datei nicht gefunden wurde (verschoben/gelöscht) */
  configMissing?: boolean
}
