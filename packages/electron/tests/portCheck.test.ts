import { describe, it, expect } from 'vitest'
import * as net from 'net'
import { isPortFree, findFreePort } from '../src/portCheck'

function bindServer(port: number): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.once('error', reject)
    s.listen(port, '127.0.0.1', () => resolve(s))
  })
}

function closeServer(s: net.Server): Promise<void> {
  return new Promise((resolve) => s.close(() => resolve()))
}

describe('isPortFree', () => {
  it('returns true for a free port', async () => {
    const result = await isPortFree(19990)
    expect(result).toBe(true)
  })

  it('returns false for a busy port', async () => {
    const s = await bindServer(19991)
    try {
      const result = await isPortFree(19991)
      expect(result).toBe(false)
    } finally {
      await closeServer(s)
    }
  })
})

describe('findFreePort', () => {
  it('returns the start port when it is free', async () => {
    const port = await findFreePort(19992)
    expect(port).toBe(19992)
  })

  it('skips busy ports and returns next free one', async () => {
    const s = await bindServer(19993)
    try {
      const port = await findFreePort(19993)
      expect(port).toBe(19994)
    } finally {
      await closeServer(s)
    }
  })

  it('returns null when all ports in range are busy', async () => {
    const servers: net.Server[] = []
    for (let i = 0; i < 5; i++) {
      servers.push(await bindServer(19970 + i))
    }
    try {
      const port = await findFreePort(19970, 5)
      expect(port).toBeNull()
    } finally {
      await Promise.all(servers.map(closeServer))
    }
  })
})
