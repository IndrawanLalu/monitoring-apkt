'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { UserProfile } from '@/lib/auth'

interface NavbarProps {
  profile: UserProfile
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📺' },
  { href: '/piket', label: 'Piket', icon: '📅' },
  { href: '/laporan', label: 'Laporan', icon: '📋' },
  { href: '/callback', label: 'Callback', icon: '📞' },
  { href: '/settings', label: 'Pengaturan', icon: '⚙️' },
]

export function Navbar({ profile }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [switchingUlp, setSwitchingUlp] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleNav(href: string) {
    if (pathname === href) return
    setPendingHref(href)
    startTransition(() => {
      router.push(href)
    })
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

  const isNavLoading = isPending

  return (
    <nav className="flex items-center justify-between px-4 h-12 border-b-2 border-neo-black bg-pln-blue shrink-0">
      {/* Brand + ULP switcher */}
      <div className="flex items-center gap-2">
        <span className="text-lg">⚡</span>
        {profile.ulps.length > 1 ? (
          <div className="flex items-center gap-1.5">
            {switchingUlp && (
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <select
              value={profile.activeUlp.id}
              onChange={(e) => handleSwitchUlp(e.target.value)}
              disabled={switchingUlp}
              className="bg-transparent text-white font-black text-sm border border-white/30 rounded px-1 py-0.5 cursor-pointer disabled:opacity-60"
            >
              {profile.ulps.map((ulp) => (
                <option key={ulp.id} value={ulp.id} className="text-neo-black bg-white">
                  {ulp.nama}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="text-white font-black text-sm tracking-wide hidden sm:block">
            {profile.activeUlp.nama}
          </span>
        )}
      </div>

      {/* Nav links */}
      <div className="flex items-center gap-0">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          const loading = isNavLoading && pendingHref === item.href
          return (
            <button
              key={item.href}
              onClick={() => handleNav(item.href)}
              disabled={isNavLoading}
              className={cn(
                'flex items-center gap-1.5 px-3 h-12 text-sm font-bold transition-colors border-r border-white/10 last:border-r-0 cursor-pointer disabled:cursor-default',
                active
                  ? 'bg-pln-yellow text-neo-black'
                  : 'text-white hover:bg-white/10',
              )}
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-base">{item.icon}</span>
              )}
              <span className="hidden md:block">{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* User info + logout */}
      <div className="flex items-center gap-2">
        <div className="text-right hidden sm:block">
          <p className="text-white text-xs font-bold leading-none">{profile.nama}</p>
          <p className="text-blue-200 text-xs font-medium">{profile.role.toUpperCase()}</p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="neo-button bg-pln-red text-white px-3 py-1 text-xs border-white! flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loggingOut && (
            <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {loggingOut ? 'Keluar...' : 'Keluar'}
        </button>
      </div>
    </nav>
  )
}
