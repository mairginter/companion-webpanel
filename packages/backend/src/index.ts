/**
 * index.ts — Backend Factory Export
 *
 * Exportiert createBackend() für Electron und Tests.
 * Standalone-Boot (npm start) ist in standalone.ts.
 */
import { Settings, SessionStatusMessage } from '@cwp/shared'
import { StateStore } from './state/StateStore'
import { ClientServer } from './server/ClientServer'
import { HostManager } from './HostManager'
import { DiscoveryService } from './discovery/DiscoveryService'

// ─── createBackend() Factory ───────────────────────────────────────────────

/**
 * createBackend — Factory für Electron und Tests.
 * Startet Backend ohne process.exit() und ohne SIGINT/SIGTERM-Handler.
 * Gibt ein Objekt zurück mit stop() für graceful shutdown.
 */
export async function createBackend(
  settings: Settings,
  port: number,
  settingsPath: string,
  onStatusChange?: (hostId: string, status: SessionStatusMessage['status']) => void,
  staticDir?: string,
): Promise<{ stop: () => Promise<void> }> {
  const store = new StateStore()
  let manager: HostManager

  // mDNS-Discovery: Browse-on-demand, gesteuert via POST /api/discovery/start|stop
  const discovery = new DiscoveryService()

  const clientServer = new ClientServer(
    port,
    settings,
    settingsPath,
    (hostId, page, row, col, pressed) => manager.handlePress(hostId, page, row, col, pressed),
    (updatedSettings) => manager.syncSubscriptions(updatedSettings),
    (hostId, page, keysPerRow, rows) => manager.addPickerSubscriptions(hostId, page, keysPerRow, rows),
    (hostId, page) => manager.removePickerSubscriptions(hostId, page),
    (hostId, page, row, col, direction) => manager.handleRotate(hostId, page, row, col, direction),
    (deviceId, keyIndex, pressed) => manager.handleVPress(deviceId, keyIndex, pressed),
    staticDir,
    () => discovery.start(),
    () => discovery.stop(),
  )

  // Jede Änderung der gefundenen Hosts an alle Frontend-Clients broadcasten
  discovery.on('update', (hosts) => clientServer.broadcast({ t: 'discovery', hosts }))
  // Neue Clients bekommen den aktuellen Discovery-Stand sofort (falls Browse läuft)
  clientServer.onNewClient((ws) => {
    clientServer.sendToClient(ws, { t: 'discovery', hosts: discovery.getHosts() })
  })

  manager = new HostManager(store, clientServer, onStatusChange)
  manager.start(settings)

  return {
    stop: async () => {
      discovery.stop()
      await manager.stop()
      await clientServer.close()
    },
  }
}

