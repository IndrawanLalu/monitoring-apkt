'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input, PasswordInput } from '@/components/ui/input'

const PESAN_TANPA_PROFIL =
  'Akun ini sudah terdaftar untuk login, tapi profil penggunanya belum dibuat sehingga belum terhubung ke ULP mana pun. Hubungi admin, atau masuk dengan akun lain.'

// useSearchParams butuh Suspense karena halaman ini di-prerender statis.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  )
}

function LoginView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Dipulangkan dari /dashboard karena sesi valid tapi baris `profiles` tidak ada.
  const tanpaProfil = searchParams.get('err') === 'no-profile'
  const notice = tanpaProfil ? PESAN_TANPA_PROFIL : null

  // Sesi seperti itu tidak bisa dipakai apa-apa, jadi langsung dibersihkan —
  // kalau dibiarkan, proxy akan memantulkan user ke /dashboard lagi tanpa henti.
  useEffect(() => {
    if (!tanpaProfil) return
    createClient().auth.signOut().catch(() => null)
  }, [tanpaProfil])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const result = loginSchema.safeParse({ email, password })
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: result.data.email,
      password: result.data.password,
    })

    if (authError) {
      setError('Email atau password salah')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base)',
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background gradient blobs */}
      <div style={{
        position: 'absolute',
        top: '-20%',
        left: '-10%',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,112,192,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-20%',
        right: '-10%',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,59,142,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
        {/* Header Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #003B8E 0%, #0070C0 100%)',
            borderRadius: '16px 16px 0 0',
            padding: '28px 32px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8, lineHeight: 1 }}>⚡</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
            MONITORING APKT
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '6px 0 0', fontWeight: 400 }}>
            Sistem Monitoring Laporan PLN
          </p>
        </div>

        {/* Form Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '0 0 16px 16px',
            border: '1px solid var(--border)',
            borderTop: 'none',
            padding: '28px 32px 24px',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          <h2 style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-secondary)',
            margin: '0 0 20px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Masuk ke Sistem
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label="Email"
              type="email"
              placeholder="cc@pln.co.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <PasswordInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {notice && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: 'rgba(255,180,0,0.12)',
                border: '1px solid rgba(255,180,0,0.35)',
              }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
                  ℹ {notice}
                </p>
              </div>
            )}

            {error && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: 'rgba(228,0,43,0.1)',
                border: '1px solid rgba(228,0,43,0.25)',
              }}>
                <p style={{ fontSize: 13, color: '#E4002B', margin: 0, fontWeight: 500 }}>
                  ⚠ {error}
                </p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              style={{ width: '100%', marginTop: 6 }}
            >
              {loading ? 'Masuk...' : 'Masuk'}
            </Button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 16 }}>
          Monitoring APKT v1.0 — Hanya untuk pengguna terotorisasi
        </p>
      </div>
    </div>
  )
}
