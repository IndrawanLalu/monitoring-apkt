import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'whatsapp-web.js',
    'puppeteer',
    'puppeteer-core',
    'unzipper',
  ],
}

export default nextConfig
