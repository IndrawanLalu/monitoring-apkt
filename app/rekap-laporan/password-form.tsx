'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkPassword } from './actions'

export function PasswordForm() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const formData = new FormData(e.currentTarget)
    const result = await checkPassword(formData)
    
    if (result.success) {
      router.refresh()
    } else {
      setError(result.error ?? 'Error')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#ECE5DD' }}>
      <div className="w-full max-w-sm">
        <div className="border-4 border-neo-black bg-neo-white p-8 shadow-neo-lg text-center transform rotate-1">
          <div className="mb-6">
            <span className="text-6xl mb-2 block">🔒</span>
            <h1 className="text-2xl font-black text-neo-black uppercase tracking-widest mt-4">Akses Terkunci</h1>
            <p className="text-sm font-bold text-gray-500 mt-2">Masukkan Sandi untuk melihat Rekap</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-left">
              <input 
                type="password" 
                name="password"
                required
                className="neo-input w-full px-4 py-3 text-lg font-bold tracking-widest text-center"
                placeholder="••••••••"
              />
            </div>
            
            {error && (
              <div className="border-2 border-neo-black bg-pln-red text-white p-2 text-sm font-bold">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-pln-blue text-white border-2 border-neo-black py-4 font-black uppercase tracking-widest text-lg shadow-neo-sm hover:-translate-x-1 hover:-translate-y-1 hover:shadow-neo transition-all disabled:opacity-50"
            >
              {loading ? 'Memeriksa...' : 'Buka Kunci'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
