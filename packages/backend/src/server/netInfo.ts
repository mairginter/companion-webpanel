/**
 * netInfo.ts
 *
 * Ermittelt die LAN-Adressen dieses Rechners (IPv4, nicht-intern).
 *
 * Wird gebraucht, um Geräte-Links anzuzeigen: Ein Tablet im Netzwerk erreicht das
 * Panel nicht über "localhost", sondern nur über die Netzwerk-Adresse des Rechners,
 * auf dem das Backend läuft. Genutzt von:
 *  - GET /api/server-info (ClientServer) → Geräte-Links-Dialog im Frontend
 *  - Electron-Startfenster (Zeile "Netzwerk:")
 */
import * as os from 'os'

/**
 * Liefert alle nicht-internen IPv4-Adressen, z.B. ['192.168.1.20', '10.0.0.5'].
 * Link-Local-Adressen (169.254.x.x — Adapter ohne DHCP-Lease) werden ans Ende
 * sortiert, weil sie für andere Geräte praktisch nie erreichbar sind.
 */
export function getLanAddresses(): string[] {
  const result: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const info of list ?? []) {
      // family ist je nach Node-Version 'IPv4' oder 4
      const isV4 = info.family === 'IPv4' || (info.family as unknown) === 4
      if (isV4 && !info.internal && !result.includes(info.address)) result.push(info.address)
    }
  }
  const isLinkLocal = (a: string) => a.startsWith('169.254.')
  return result.sort((a, b) => Number(isLinkLocal(a)) - Number(isLinkLocal(b)))
}
