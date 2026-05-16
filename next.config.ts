import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
