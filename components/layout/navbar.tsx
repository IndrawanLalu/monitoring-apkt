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
  { href: '/apkt',        label: 'APKT',            icon: '🔗' },
  { href: '/settings',    label: 'Pengaturan',      icon: '⚙️' },
]

export function Navbar({ profile }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [switchingUlp, setSwitchingUlp] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleSwitchUlp(ulpId: string) {
    if (ulpId === profile.activeUlp.id) return
    setSwitchingUlp(true)
    await fetch('/api/switch-ulp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ulp_id: ulpId }),
    })
    router.refresh()
    setSwitchingUlp(false)
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
        {profile.ulps.length > 1 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {switchingUlp && (
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  border: '2px solid var(--accent)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            )}
            <select
              value={profile.activeUlp.id}
              onChange={(e) => handleSwitchUlp(e.target.value)}
              disabled={switchingUlp}
              className="input"
              style={{
                width: 'auto',
                padding: '3px 8px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                maxWidth: 180,
              }}
            >
              {profile.ulps.map((ulp) => (
                <option key={ulp.id} value={ulp.id}>{ulp.nama}</option>
              ))}
            </select>
          </div>
        ) : (
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
            className="hidden sm:block"
          >
            {profile.activeUlp.nama}
          </span>
        )}
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
              prefetch={true}
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
