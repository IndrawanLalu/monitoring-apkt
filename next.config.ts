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
  // Header keamanan dasar. CSP sengaja belum dipasang — butuh penyetelan
  // hati-hati untuk inline style Next dan koneksi realtime Supabase.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Halaman /antrian dibuka pelanggan lewat link WA; tanpa ini, situs
          // mana pun bisa mem-frame-nya.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Token antrian ada di URL — jangan sampai ikut terkirim ke domain
          // luar lewat header Referer.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
            : []),
        ],
      },
    ]
  },
}

export default nextConfig
