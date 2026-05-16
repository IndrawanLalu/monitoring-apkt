'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

interface UlpInfo {
  id: string
  nama: string
  kode: string
}

interface UserCc {
  id: string
  nama: string
  email: string
  ulp_id: string
  ulps: string[]
}

interface Props {
  ulps: UlpInfo[]
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void
}

export function UsersTab({ ulps, onToast }: Props) {
  const [users, setUsers] = useState<UserCc[]>([])
  const [loading, setLoading] = useState(true)
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserCc | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedUlps, setSelectedUlps] = useState<string[]>([])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const json = await res.json()
      if (res.ok && json.data) {
        setUsers(json.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const ulpMap = new Map(ulps.map(u => [u.id, u.nama]))

  function openAdd() {
    setModalMode('add')
    setSelectedUser(null)
    setNama('')
    setEmail('')
    setPassword('')
    setSelectedUlps([])
    setError(null)
  }

  function openEdit(user: UserCc) {
    setModalMode('edit')
    setSelectedUser(user)
    setNama(user.nama)
    setEmail(user.email)
    setPassword('') // Kosongkan, hanya diisi jika ingin ganti password
    setSelectedUlps(user.ulps || [user.ulp_id])
    setError(null)
  }

  function toggleUlp(id: string) {
    setSelectedUlps(prev =>
      prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nama.trim()) { setError('Nama wajib diisi'); return }
    if (modalMode === 'add' && (!email.trim() || !password)) {
      setError('Email dan password wajib diisi untuk user baru')
      return
    }
    if (selectedUlps.length === 0) {
      setError('Pilih minimal 1 ULP untuk cakupan tugas CC')
      return
    }

    setSubmitting(true)
    try {
      if (modalMode === 'add') {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama: nama.trim(), email: email.trim(), password, ulp_ids: selectedUlps }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error ?? 'Gagal membuat user')
        setUsers(prev => [...prev, json.data])
        onToast('User CC berhasil dibuat', 'success')
      } else if (modalMode === 'edit' && selectedUser) {
        const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nama: nama.trim(),
            password: password ? password : undefined,
            ulp_ids: selectedUlps,
          }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error ?? 'Gagal update user')
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, nama: nama.trim(), ulps: selectedUlps, ulp_id: selectedUlps[0] } : u))
        onToast('User CC berhasil diupdate', 'success')
      }
      setModalMode(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(user: UserCc) {
    if (!confirm(`Hapus akun CC "${user.nama}" (${user.email}) secara permanen?`)) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Gagal menghapus user')
      setUsers(prev => prev.filter(u => u.id !== user.id))
      onToast('User CC berhasil dihapus', 'success')
    } catch (err: any) {
      onToast(err.message, 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>👥 Manajemen User CC</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Kelola akun petugas Command Center untuk UP3 Anda. Satu akun CC dapat ditugaskan ke satu atau beberapa ULP sekaligus.
          </p>
        </div>
        <Button variant="primary" onClick={openAdd}>+ Buat User CC Baru</Button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Memuat data user...</div>
      ) : users.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 12, backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-muted)', fontSize: 13 }}>
          Belum ada user CC di UP3 Anda. Klik &quot;+ Buat User CC Baru&quot; untuk menambahkan.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {users.map(user => (
            <div key={user.id} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{user.nama}</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', fontFamily: 'monospace' }}>{user.email}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, backgroundColor: 'rgba(29,185,84,0.12)', color: '#1DB954', border: '1px solid rgba(29,185,84,0.25)' }}>CC Petugas</span>
                </div>

                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>Cakupan ULP ({user.ulps?.length || 1}):</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(user.ulps || [user.ulp_id]).map(uid => (
                      <span key={uid} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                        ⚡ {ulpMap.get(uid) ?? uid}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => openEdit(user)}>Edit</Button>
                <Button variant="danger" size="sm" style={{ flex: 1 }} onClick={() => handleDelete(user)}>Hapus</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add / Edit */}
      <Modal open={!!modalMode} onClose={() => setModalMode(null)} title={modalMode === 'add' ? 'Buat User CC Baru' : 'Edit User CC'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Nama Lengkap *" placeholder="Budi Command Center" value={nama} onChange={e => setNama(e.target.value)} />

          <Input
            label="Email / Username Login *"
            placeholder="ccampenantanjung@pln.co.id"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={modalMode === 'edit'}
            hint={modalMode === 'edit' ? 'Email login tidak dapat diubah' : 'Gunakan format email untuk login'}
          />

          <Input
            label={modalMode === 'add' ? 'Password *' : 'Ganti Password (Opsional)'}
            type="password"
            placeholder={modalMode === 'add' ? 'Minimal 6 karakter' : 'Kosongkan jika tidak ingin mengubah password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'block' }}>
              Pilih Cakupan ULP (Bisa lebih dari satu) <span style={{ color: '#E4002B' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ulps.map(ulp => {
                const isSelected = selectedUlps.includes(ulp.id)
                return (
                  <button
                    key={ulp.id}
                    type="button"
                    onClick={() => toggleUlp(ulp.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: '2px solid',
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                      backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-surface-2)',
                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer', transition: 'all 0.15s ease', outline: 'none',
                    }}
                  >
                    <span style={{ width: 14, height: 14, borderRadius: 3, border: isSelected ? 'none' : '2px solid var(--border-strong)', backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                      {isSelected && '✓'}
                    </span>
                    {ulp.nama}
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: 'rgba(228,0,43,0.1)', border: '1px solid rgba(228,0,43,0.25)' }}>
              <p style={{ fontSize: 13, color: '#E4002B', margin: 0, fontWeight: 500 }}>⚠ {error}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
            <Button variant="secondary" type="button" onClick={() => setModalMode(null)}>Batal</Button>
            <Button variant="primary" type="submit" loading={submitting}>Simpan</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
