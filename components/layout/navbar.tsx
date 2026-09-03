'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { UserProfile } from '@/lib/auth'
import { ThemeToggle } from './theme-toggle'

interface NavbarProps {
  profile: UserProfile
}

const NAV_ITEMS = [
  { href: '/cc-callback', label: 'CC Call Back',   icon: '☎️' },
  { href: '/callback',    label: 'Laporan APKT',   icon: '📤' },
  { href: '/dashboard',   label: 'Dashboard',       icon: '📺' },
  { href: '/piket',       label: 'Piket',           icon: '📅' },
  { href: '/laporan',     label: 'Rekap',           icon: '📊' },
  { href: '/outage',      label: 'Outage',          icon: '⚡' },
  { href: '/apkt',        label: 'APKT',            icon: '🔗' },
  { href: '/settings',    label: 'Pengaturan',      icon: '⚙️' },
]

export function Navbar({ profile }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav
      className="shrink-0 glass"
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
        paddingRight: 16,
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Brand + ULP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 0 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #003B8E 0%, #0070C0 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,112,192,0.4)',
          }}
        >
          ⚡
        </div>
        {/* Lingkup akun, bukan daftar isinya: akun up3 menaungi 4 ULP dan akun
            uiw 16 — mendaftar semuanya mendorong menu keluar layar. Jumlahnya
            tetap ditampilkan sebagai lencana kecil supaya informasinya tidak
            hilang, dan nama lengkapnya ada di tooltip. */}
        <span
          className="hidden sm:flex"
          style={{ alignItems: 'center', gap: 6, minWidth: 0 }}
          title={profile.ulps.map((u) => u.nama).join(', ')}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 200,
            }}
          >
            {profile.lingkup}
          </span>
          {profile.ulps.length > 1 && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 999,
                backgroundColor: 'var(--bg-surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {profile.ulps.length} ULP
            </span>
          )}
        </span>
      </div>

      {/* Nav Links */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          flexShrink: 1,
          minWidth: 0,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                backgroundColor: active ? 'var(--accent-subtle)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                if (!active) {
                  const el = e.currentTarget
                  el.style.backgroundColor = 'var(--bg-surface-2)'
                  el.style.color = 'var(--text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  const el = e.currentTarget
                  el.style.backgroundColor = 'transparent'
                  el.style.color = 'var(--text-secondary)'
                }
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>{item.icon}</span>
              <span className="hidden md:block">{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Right: Theme toggle + User + Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <ThemeToggle />
        <div className="hidden sm:block" style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {profile.nama}
          </p>
          <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {profile.role}
          </p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="btn btn-danger btn-sm"
          style={{ gap: 5 }}
        >
          {loggingOut && (
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                border: '1.5px solid white',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
          {loggingOut ? 'Keluar...' : 'Keluar'}
        </button>
      </div>
    </nav>
  )
}
