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
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
      ],
    },
  })

  clients.set(userId, client)
  return client
}

export async function destroyWaClient(userId: string, caller = 'unknown'): Promise<void> {
  const short = userId.slice(0, 8)
  console.log(`[WA Destroy] START user:${short} caller:${caller} inMap:${clients.has(userId)} registered:${registeredHandlers.has(userId)}`)

  const client = clients.get(userId)
  if (client) {
    try { await client.logout().catch(() => null) } catch {}
    try { await client.destroy().catch(() => null) } catch {}
    clients.delete(userId)
    registeredHandlers.delete(userId)
    console.log(`[WA Destroy] client.destroy() done, removed from map user:${short}`)
  } else {
    console.log(`[WA Destroy] no client in map for user:${short}`)
  }

  const sessionDir = process.env.WA_SESSION_DIR ?? './wa-sessions'
  const targetDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), sessionDir, `session-user-${userId}`)
  const folderExists = fs.existsSync(targetDir)
  console.log(`[WA Destroy] folder exists:${folderExists} path:${targetDir}`)

  const lockFile = path.join(targetDir, 'SingletonLock')
  const lockExists = fs.existsSync(lockFile)
  console.log(`[WA Destroy] SingletonLock exists:${lockExists}`)

  if (lockExists) {
    try {
      execSync(`fuser -k -9 "${lockFile}" 2>/dev/null || true`)
      console.log(`[WA Destroy] fuser kill done`)
    } catch (e) { console.log(`[WA Destroy] fuser error:`, e) }
    try {
      const link = fs.readlinkSync(lockFile)
      const pid = link.split('-').pop()
      console.log(`[WA Destroy] SingletonLock link:"${link}" pid:"${pid}"`)
      if (pid && /^\d+$/.test(pid)) {
        execSync(`kill -9 ${pid} 2>/dev/null || true`)
        console.log(`[WA Destroy] kill -9 ${pid} done`)
      }
    } catch (e) { console.log(`[WA Destroy] PID kill error:`, e) }
  }

  try {
    execSync(`pkill -f "session-user-${userId}" 2>/dev/null || true`)
    console.log(`[WA Destroy] pkill done`)
  } catch {}

  try {
    execSync(
      `for pid in $(ls /proc | grep -E '^[0-9]+$'); do` +
      ` grep -ql "session-user-${userId}" /proc/$pid/cmdline 2>/dev/null &&` +
      ` kill -9 $pid 2>/dev/null; done`,
      { shell: '/bin/bash' }
    )
    console.log(`[WA Destroy] /proc scan kill done`)
  } catch {}

  await new Promise((r) => setTimeout(r, 300))

  if (fs.existsSync(targetDir)) {
    try {
      fs.rmSync(targetDir, { recursive: true, force: true })
      console.log(`[WA Destroy] folder deleted user:${short}`)
    } catch (e) {
      console.error(`[WA Destroy] GAGAL hapus folder user:${short}`, e)
    }
  } else {
    console.log(`[WA Destroy] folder sudah tidak ada user:${short}`)
  }

  console.log(`[WA Destroy] DONE user:${short} inMap:${clients.has(userId)} registered:${registeredHandlers.has(userId)}`)
}

export function hasWaSession(userId: string): boolean {
  const sessionDir = process.env.WA_SESSION_DIR ?? './wa-sessions'
  const targetDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), sessionDir, `session-user-${userId}`)
  return fs.existsSync(targetDir)
}

export function getAllWaClients(): Map<string, Client> {
  return clients
}
