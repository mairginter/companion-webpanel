/**
 * portCheck.ts — Port-Verfügbarkeit prüfen
 *
 * Testet ob ein TCP-Port frei ist und sucht ggf. den nächsten freien Port.
 * Reine Node.js-Logik (kein Electron) — vollständig testbar.
 */
import * as net from 'net'

/**
 * Prüft ob ein Port auf 127.0.0.1 frei ist.
 * Versucht kurz zu binden — gibt true zurück wenn erfolgreich.
 */
export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '127.0.0.1')
  })
}

/**
 * Sucht den ersten freien Port ab startPort.
 * Gibt null zurück wenn in maxAttempts kein freier Port gefunden wurde.
 */
export async function findFreePort(
  startPort: number,
  maxAttempts = 10,
): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortFree(startPort + i)) return startPort + i
  }
  return null
}
