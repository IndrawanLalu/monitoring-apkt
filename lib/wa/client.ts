import { Client, LocalAuth } from "whatsapp-web.js";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

// Global singleton — keyed by user_id (bukan ulp_id)
const g = global as typeof global & {
  _waClients?: Map<string, Client>;
  _waRegistered?: Set<string>;
  _waInitLocks?: Set<string>;
};

const clients: Map<string, Client> = g._waClients ?? (g._waClients = new Map());
const registeredHandlers: Set<string> =
  g._waRegistered ?? (g._waRegistered = new Set());
const initLocks: Set<string> = g._waInitLocks ?? (g._waInitLocks = new Set());

export function isInitLocked(userId: string): boolean {
  return initLocks.has(userId);
}

export function acquireInitLock(userId: string): boolean {
  if (initLocks.has(userId)) return false;
  initLocks.add(userId);
  // Safety net: auto-release after 3 minutes jika handler tidak merelease
  setTimeout(() => initLocks.delete(userId), 180_000);
  return true;
}

export function releaseInitLock(userId: string): void {
  initLocks.delete(userId);
}

export function isClientRegistered(userId: string): boolean {
  return registeredHandlers.has(userId);
}

export function markClientRegistered(userId: string): void {
  registeredHandlers.add(userId);
}

export function getWaClient(userId: string): Client | null {
  return clients.get(userId) ?? null;
}

export function getOrCreateWaClient(userId: string): Client {
  if (clients.has(userId)) return clients.get(userId)!;

  const sessionDir = process.env.WA_SESSION_DIR ?? "./wa-sessions";

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `user-${userId}`,
      dataPath: path.resolve(
        /*turbopackIgnore: true*/ process.cwd(),
        sessionDir,
      ),
    }),
    // Pin versi WA Web agar tidak auto-update mid-session (penyebab detached frame)
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.x.json',
    },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    puppeteer: {
      headless: true,
      executablePath: process.env.CHROME_PATH || undefined,
      protocolTimeout: 300000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--disable-gpu",
        "--disable-features=site-per-process",
      ],
    },
  });

  clients.set(userId, client);
  return client;
}

export async function destroyWaClient(
  userId: string,
  caller = "unknown",
  opts: { keepSession?: boolean } = {},
): Promise<void> {
  const short = userId.slice(0, 8);
  console.log(
    `[WA Destroy] START user:${short} caller:${caller} keepSession:${!!opts.keepSession} inMap:${clients.has(userId)} registered:${registeredHandlers.has(userId)}`,
  );

  const client = clients.get(userId);
  if (client) {
    // Kill Chrome langsung via PID — lebih reliable dari pkill/fuser
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chromePid = (client as any).pupBrowser?.process()?.pid as
        | number
        | undefined;
      if (chromePid) {
        process.kill(chromePid, "SIGKILL");
        console.log(
          `[WA Destroy] SIGKILL chromePid:${chromePid} user:${short}`,
        );
      } else {
        console.log(`[WA Destroy] chromePid not available user:${short}`);
      }
    } catch (e) {
      console.log(`[WA Destroy] chromePid kill error:`, e);
    }

    // logout() hanya saat full destroy — jangan saat keepSession karena akan invalidate sesi WA
    if (!opts.keepSession) {
      try {
        await client.logout().catch(() => null);
      } catch {}
    }
    try {
      await client.destroy().catch(() => null);
    } catch {}
    clients.delete(userId);
    registeredHandlers.delete(userId);
    console.log(
      `[WA Destroy] client.destroy() done, removed from map user:${short}`,
    );
  } else {
    console.log(`[WA Destroy] no client in map for user:${short}`);
  }

  const sessionDir = process.env.WA_SESSION_DIR ?? "./wa-sessions";
  const targetDir = path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    sessionDir,
    `session-user-${userId}`,
  );
  const folderExists = fs.existsSync(targetDir);
  console.log(`[WA Destroy] folder exists:${folderExists} path:${targetDir}`);

  // Kill semua Chrome yang menggunakan session folder ini (termasuk zombie)
  async function killZombieChrome() {
    // Kill Chrome main process via SingletonLock PID first (most precise — avoids cmdline truncation issues)
    const lockFile = path.join(targetDir, "SingletonLock");
    if (fs.existsSync(lockFile)) {
      try {
        const link = fs.readlinkSync(lockFile);
        const pid = parseInt(link.split("-").pop() ?? "");
        console.log(`[WA Destroy] SingletonLock pid:${pid} user:${short}`);
        if (pid > 0) {
          try {
            process.kill(pid, "SIGKILL");
          } catch {}
        }
      } catch {}
    }
    // Fallback: [s] trick prevents pkill from matching its own bash subprocess cmdline
    try {
      execSync(`pkill -9 -f "[s]ession-user-${userId}" 2>/dev/null || true`);
    } catch {}
  }

  await killZombieChrome();
  console.log(`[WA Destroy] kill round 1 done user:${short}`);
  await new Promise((r) => setTimeout(r, 2000));

  // keepSession: jangan hapus folder — Chrome akan reuse session saat reconnect (tanpa QR)
  if (opts.keepSession) {
    console.log(`[WA Destroy] keepSession — folder preserved user:${short}`);
  } else {
    function tryDeleteFolder() {
      if (!fs.existsSync(targetDir)) return false;
      try {
        fs.rmSync(targetDir, { recursive: true, force: true });
      } catch {}
      return fs.existsSync(targetDir); // true = masih ada (gagal hapus)
    }

    if (tryDeleteFolder()) {
      // Folder masih ada — Chrome zombie sempat rekonstruksi, kill lagi
      console.log(
        `[WA Destroy] ZOMBIE folder masih ada, kill round 2 user:${short}`,
      );
      await killZombieChrome();
      await new Promise((r) => setTimeout(r, 2000));
      if (tryDeleteFolder()) {
        console.error(
          `[WA Destroy] ZOMBIE folder MASIH ADA setelah 2x kill user:${short}`,
        );
      } else {
        console.log(`[WA Destroy] folder deleted (round 2) user:${short}`);
      }
    } else {
      console.log(`[WA Destroy] folder deleted user:${short}`);
    }
  }

  console.log(
    `[WA Destroy] DONE user:${short} inMap:${clients.has(userId)} registered:${registeredHandlers.has(userId)}`,
  );
}

export function hasWaSession(userId: string): boolean {
  const sessionDir = process.env.WA_SESSION_DIR ?? "./wa-sessions";
  const targetDir = path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    sessionDir,
    `session-user-${userId}`,
  );
  return fs.existsSync(targetDir);
}

export function getAllWaClients(): Map<string, Client> {
  return clients;
}
