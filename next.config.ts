import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Izinkan akses dev via IP LAN / host non-localhost (hindari blokir cross-origin /_next).
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.1.3',
    '192.168.1.70',
    '192.168.1.70.nip.io',
    '192.168.1.3.nip.io',
  ],
  serverExternalPackages: [
    'whatsapp-web.js',
    'puppeteer',
    'puppeteer-core',
    'unzipper',
  ],
  experimental: {
    staleTimes: {
      dynamic: 0,   // Dynamic pages (force-dynamic) tidak di-cache di browser
      static: 300,  // Static pages tetap di-cache 5 menit (default)
    },
  },
}

export default nextConfig
