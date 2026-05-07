import { Client, LocalAuth } from 'whatsapp-web.js'
import path from 'path'

// Global singleton agar persisten antar API route dan hot reload Next.js
const g = global as typeof global & {
  _waClients?: Map<string, Client>
  _waRegistered?: Set<string>
}

const clients: Map<string, Client> = g._waClients ?? (g._waClients = new Map())
const registeredHandlers: Set<string> = g._waRegistered ?? (g._waRegistered = new Set())

export function isClientRegistered(ulpId: string): boolean {
  return registeredHandlers.has(ulpId)
}

export function markClientRegistered(ulpId: string): void {
  registeredHandlers.add(ulpId)
}

export function getWaClient(ulpId: string): Client | null {
  return clients.get(ulpId) ?? null
}

export function getOrCreateWaClient(ulpId: string): Client {
  if (clients.has(ulpId)) return clients.get(ulpId)!

  const sessionDir = process.env.WA_SESSION_DIR ?? './wa-sessions'

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `ulp-${ulpId}`,
      dataPath: path.resolve(/*turbopackIgnore: true*/ process.cwd(), sessionDir),
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.CHROME_PATH || undefined,
      protocolTimeout: 300000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu',
      ],
    },
  })

  clients.set(ulpId, client)
  return client
}

export function destroyWaClient(ulpId: string): void {
  const client = clients.get(ulpId)
  if (client) {
    client.destroy().catch(() => null)
    clients.delete(ulpId)
    registeredHandlers.delete(ulpId)
  }
}

export function getAllWaClients(): Map<string, Client> {
  return clients
}
