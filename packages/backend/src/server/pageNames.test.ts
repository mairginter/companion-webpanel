// packages/backend/src/server/pageNames.test.ts
//
// Seitennamen-Resolver (Companion HTTP-API Proxy) — fetch gemockt.
import { describe, it, expect, vi } from 'vitest'
import { PageNameResolver, PAGE_NAME_TTL_MS } from './pageNames'

function okResponse(body: string) {
  return { status: 200, text: async () => body } as Response
}

describe('PageNameResolver', () => {
  it('liefert den Seitennamen bei HTTP 200 und ruft die richtige URL auf', async () => {
    const fetchMock = vi.fn(async () => okResponse('PTZ Canon Control'))
    const resolver = new PageNameResolver(fetchMock as unknown as typeof fetch)
    const name = await resolver.resolve('10.0.0.1', 8000, 1)
    expect(name).toBe('PTZ Canon Control')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://10.0.0.1:8000/api/variable/internal/page_number_1_name/value',
      expect.anything(),
    )
  })

  it('liefert leeren Namen bei 403 (http_api_enabled aus)', async () => {
    const fetchMock = vi.fn(async () => ({ status: 403, text: async () => 'Forbidden' }) as Response)
    const resolver = new PageNameResolver(fetchMock as unknown as typeof fetch)
    expect(await resolver.resolve('10.0.0.1', 8000, 1)).toBe('')
  })

  it('liefert leeren Namen bei Timeout/Verbindungsfehler', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('timeout') })
    const resolver = new PageNameResolver(fetchMock as unknown as typeof fetch)
    expect(await resolver.resolve('10.0.0.1', 8000, 1)).toBe('')
  })

  it('cached Ergebnisse für die TTL-Dauer (auch leere)', async () => {
    let now = 1_000_000
    const fetchMock = vi.fn(async () => okResponse('Studio'))
    const resolver = new PageNameResolver(fetchMock as unknown as typeof fetch, () => now)
    await resolver.resolve('10.0.0.1', 8000, 2)
    await resolver.resolve('10.0.0.1', 8000, 2)
    expect(fetchMock).toHaveBeenCalledTimes(1) // zweiter Aufruf aus dem Cache
    now += PAGE_NAME_TTL_MS + 1
    await resolver.resolve('10.0.0.1', 8000, 2)
    expect(fetchMock).toHaveBeenCalledTimes(2) // TTL abgelaufen → neu geholt
  })

  it('cached pro Host+Port+Page getrennt', async () => {
    const fetchMock = vi.fn(async () => okResponse('X'))
    const resolver = new PageNameResolver(fetchMock as unknown as typeof fetch)
    await resolver.resolve('10.0.0.1', 8000, 1)
    await resolver.resolve('10.0.0.1', 8000, 2)
    await resolver.resolve('10.0.0.2', 8000, 1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('trimmt Whitespace aus der Antwort', async () => {
    const fetchMock = vi.fn(async () => okResponse('  Kameras \n'))
    const resolver = new PageNameResolver(fetchMock as unknown as typeof fetch)
    expect(await resolver.resolve('10.0.0.1', 8000, 3)).toBe('Kameras')
  })
})
