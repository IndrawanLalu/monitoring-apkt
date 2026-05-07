'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loginSchema } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    <div className="min-h-screen flex items-center justify-center bg-neo-white p-4">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, #1A1A1A 0px, #1A1A1A 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #1A1A1A 0px, #1A1A1A 1px, transparent 1px, transparent 40px)',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo / Header */}
        <div className="neo-card mb-6 p-6 text-center" style={{ backgroundColor: '#003B8E' }}>
          <div className="text-4xl mb-2">⚡</div>
          <h1 className="text-2xl font-black text-white tracking-tight">MONITORING APKT</h1>
          <p className="text-sm text-blue-200 font-medium mt-1">Sistem Monitoring Laporan PLN</p>
        </div>

        {/* Login Form */}
        <div className="neo-card p-6">
          <h2 className="text-lg font-black text-neo-black mb-6 uppercase tracking-wide">
            Masuk ke Sistem
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="cc@pln.co.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <div className="neo-border p-3 bg-red-50 border-pln-red!">
                <p className="text-sm font-medium text-pln-red">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full mt-2"
            >
              {loading ? 'Masuk...' : 'Masuk'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 font-medium">
          Monitoring APKT v1.0 — Hanya untuk pengguna terotorisasi
        </p>
      </div>
    </div>
  )
}
