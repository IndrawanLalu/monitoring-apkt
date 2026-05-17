import { Client, LocalAuth } from 'whatsapp-web.js'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

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
        '--disable-features=site-per-process',
        '--disable-web-security',
        '--allow-running-insecure-content',
      ],
    },
  })

  clients.set(userId, client)
  return client
}

export async function destroyWaClient(userId: string): Promise<void> {
  const client = clients.get(userId)
  if (client) {
    try {
      await client.logout().catch(() => null)
    } catch (e) {}
    try {
      await client.destroy().catch(() => null)
    } catch (e) {}
    clients.delete(userId)
    registeredHandlers.delete(userId)
  }

  // Kill Chrome zombie process via SingletonLock PID sebelum hapus folder
  const sessionDir = process.env.WA_SESSION_DIR ?? './wa-sessions'
  const targetDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), sessionDir, `session-user-${userId}`)
  try {
    const lockFile = path.join(targetDir, 'SingletonLock')
    if (fs.existsSync(lockFile)) {
      const link = fs.readlinkSync(lockFile)
      const pid = link.split('-')[1]
      if (pid) execSync(`kill -9 ${pid} 2>/dev/null || true`)
    }
  } catch {}
  // Fallback: kill by data directory path
  try {
    execSync(`pkill -f "session-user-${userId}" 2>/dev/null || true`)
  } catch {}
  try {
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }
  } catch (e) {
    console.error('[WA Cleanup] Error checking/deleting session folder:', e)
  }
}

export function getAllWaClients(): Map<string, Client> {
  return clients
}
