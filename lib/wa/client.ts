import { Client, LocalAuth } from 'whatsapp-web.js'
import path from 'path'

// Global singleton — keyed by user_id (bukan ulp_id)
const g = global as typeof global & {
  _waClients?: Map<string, Client>
  _waRegistered?: Set<string>
}

const clients: Map<string, Client> = g._waClients ?? (g._waClients = new Map())
const registeredHandlers: Set<string> = g._waRegistered ?? (g._waRegistered = new Set())

export function isClientRegistered(userId: string): boolean {
  return registeredHandlers.has(userId)
}

export function markClientRegistered(userId: string): void {
  registeredHandlers.add(userId)
}

export function getWaClient(userId: string): Client | null {
  return clients.get(userId) ?? null
}

export function getOrCreateWaClient(userId: string): Client {
  if (clients.has(userId)) return clients.get(userId)!

  const sessionDir = process.env.WA_SESSION_DIR ?? './wa-sessions'

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `user-${userId}`,
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

  clients.set(userId, client)
  return client
}

export function destroyWaClient(userId: string): void {
  const client = clients.get(userId)
  if (client) {
    client.destroy().catch(() => null)
    clients.delete(userId)
    registeredHandlers.delete(userId)
  }
}

export function getAllWaClients(): Map<string, Client> {
  return clients
}
