'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input, PasswordInput, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useKonfirmasi } from '@/components/ui/konfirmasi'
import { BOLEH_MEMBUAT, LABEL_ROLE } from '@/constants'

interface UlpInfo {
  id: string
  nama: string
  kode?: string
  /** Induk UP3, dikirim getProfile — dipakai mengelompokkan pemilih ULP. */
  up3_id?: string | null
  up3?: { nama: string; kode: string } | null
}

interface UserCc {
  id: string
  nama: string
  email: string
  role: string
  /** Akun yang sedang login — tidak boleh menghapus dirinya sendiri. */
  diriSendiri?: boolean
  ulp_id: string
  ulps: string[]
}

/** Label peran versi manusia. Sengaja tidak memakai nilai enum mentah di UI. */
const LABEL_PERAN: Record<string, { teks: string; warna: string }> = {
  admin:      { teks: 'Admin UP3', warna: '#0070C0' },
  supervisor: { teks: 'Supervisor', warna: '#7C3AED' },
  cc:         { teks: 'Operator',  warna: '#64748B' },
}

interface Props {
  ulps: UlpInfo[]
  /** Peran akun yang sedang login — menentukan peran apa saja yang boleh dibuat. */
  peranSaya: string
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void
}

interface Wilayah { id: string; nama: string; kode: string }

export function UsersTab({ ulps, peranSaya, onToast }: Props) {
  const konfirmasi = useKonfirmasi()
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
  const [peran, setPeran] = useState('operator')
  const [up3Id, setUp3Id] = useState('')
  const [uiwId, setUiwId] = useState('')
  const [daftarUp3, setDaftarUp3] = useState<Wilayah[]>([])
  const [daftarUiw, setDaftarUiw] = useState<Wilayah[]>([])
  // Password sementara hasil reset — ditampilkan SEKALI, tidak disimpan.
  const [pwSementara, setPwSementara] = useState<{ nama: string; pw: string } | null>(null)

  // Peran apa saja yang boleh saya buat. Sumbernya sama dengan yang dipakai
  // server, jadi UI tidak pernah menawarkan pilihan yang nanti ditolak API.
  const peranBoleh = BOLEH_MEMBUAT[peranSaya] ?? []

  // ULP dikelompokkan per UP3. Super admin bisa melihat belasan ULP dari
  // banyak UP3 sekaligus; deretan chip rata memaksa orang memindai satu per
  // satu untuk menemukan yang dicari.
  const kelompokUlp = useMemo(() => {
    const peta = new Map<string, { kunci: string; judul: string; items: UlpInfo[] }>()
    for (const u of ulps) {
      const kunci = u.up3_id ?? '__tanpa__'
      if (!peta.has(kunci)) {
        peta.set(kunci, {
          kunci,
          judul: u.up3 ? `${u.up3.nama} (${u.up3.kode})` : 'Tanpa UP3',
          items: [],
        })
      }
      peta.get(kunci)!.items.push(u)
    }
    return [...peta.values()].sort((a, b) => a.judul.localeCompare(b.judul))
  }, [ulps])

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

  // Daftar wilayah untuk dropdown; hanya diambil kalau memang bisa dipakai.
  useEffect(() => {
    if (!peranBoleh.includes('up3') && !peranBoleh.includes('uiw')) return
    let batal = false
    ;(async () => {
      const [rUp3, rUiw] = await Promise.all([
        fetch('/api/admin/up3').then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/uiw').then(r => r.json()).catch(() => ({})),
      ])
      if (batal) return
      setDaftarUp3(rUp3.data ?? [])
      setDaftarUiw(rUiw.data ?? [])
    })()
    return () => { batal = true }
  }, [peranBoleh])

  const ulpMap = new Map(ulps.map(u => [u.id, u.nama]))

  function openAdd() {
    setModalMode('add')
    setSelectedUser(null)
    setNama('')
    setEmail('')
    setPassword('')
    setSelectedUlps([])
    setPeran(peranBoleh[peranBoleh.length - 1] ?? 'operator')
    setUp3Id('')
    setUiwId('')
    setError(null)
  }

  function openEdit(user: UserCc) {
    setModalMode('edit')
    setSelectedUser(user)
    setNama(user.nama)
    setEmail(user.email)
    setPassword('') // Kosongkan, hanya diisi jika ingin ganti password
    setSelectedUlps(user.ulps || [user.ulp_id])
    setPeran(user.role)
    setUp3Id('')
    setUiwId('')
    setError(null)
  }

  function toggleUlp(id: string) {
    setSelectedUlps(prev =>
      prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
    )
  }

  async function handleReset(user: UserCc) {
    const ok = await konfirmasi({
      judul: 'Reset password akun ini?',
      pesan: 'Password lama langsung tidak berlaku. Password sementara akan ditampilkan sekali saja — catat sebelum menutup dialog.',
      rincian: [
        { label: 'Nama', nilai: user.nama },
        { label: 'Email', nilai: user.email },
      ],
      labelAksi: 'Reset password',
      aksi: async () => {
        const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: 'POST' })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error ?? 'Gagal mereset password')
        setPwSementara({ nama: user.nama, pw: json.password })
      },
    })
    if (!ok) return
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nama.trim()) { setError('Nama wajib diisi'); return }
    if (modalMode === 'add' && (!email.trim() || !password)) {
      setError('Email dan password wajib diisi untuk user baru')
      return
    }
    // Cakupan yang wajib berbeda per peran: operator butuh ULP, up3 butuh
    // UP3, uiw butuh UIW. Diperiksa juga di server; ini supaya pesannya
    // muncul sebelum permintaan dikirim.
    if (peran === 'operator' && selectedUlps.length === 0) {
      setError('Pilih minimal 1 ULP untuk cakupan tugas operator')
      return
    }
    if (peran === 'up3' && !up3Id) { setError('Pilih UP3 untuk akun Admin UP3'); return }
    if (peran === 'uiw' && !uiwId) { setError('Pilih UIW untuk akun Admin UIW'); return }

    setSubmitting(true)
    try {
      if (modalMode === 'add') {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nama: nama.trim(), email: email.trim(), password,
            role: peran,
            ulp_ids: peran === 'operator' ? selectedUlps : [],
            up3_id: peran === 'up3' ? up3Id : undefined,
            uiw_id: peran === 'uiw' ? uiwId : undefined,
          }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error ?? 'Gagal membuat user')
        setUsers(prev => [...prev, json.data])
        onToast('Akun berhasil dibuat', 'success')
      } else if (modalMode === 'edit' && selectedUser) {
        const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nama: nama.trim(),
            password: password ? password : undefined,
            ulp_ids: peran === 'operator' ? selectedUlps : [],
            // Peran hanya dikirim kalau benar-benar berubah — mengirimnya
            // apa adanya akan ditolak untuk akun sendiri.
            role: peran !== selectedUser.role ? peran : undefined,
            up3_id: peran === 'up3' ? up3Id : undefined,
            uiw_id: peran === 'uiw' ? uiwId : undefined,
          }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error ?? 'Gagal update user')
        setUsers(prev => prev.map(u => u.id === selectedUser.id
          ? { ...u, nama: nama.trim(), role: peran, ulps: selectedUlps, ulp_id: selectedUlps[0] } : u))
        onToast('Akun berhasil diperbarui', 'success')
      }
      setModalMode(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(user: UserCc) {
    const ok = await konfirmasi({
      judul: 'Hapus akun ini secara permanen?',
      pesan: 'Akun tidak bisa dipakai login lagi dan aksesnya ke semua ULP dicabut.',
      rincian: [
        { label: 'Nama', nilai: user.nama },
        { label: 'Email', nilai: user.email },
      ],
      varian: 'danger',
      labelAksi: 'Hapus akun',
    })
    if (!ok) return
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
            Kelola akun pengguna di UP3 Anda. Satu akun dapat ditugaskan ke satu atau beberapa ULP sekaligus.
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
                  {(() => {
                    // Badge peran sungguhan, bukan label statis "CC Petugas".
                    // Daftar ini kini memuat semua peran, jadi labelnya harus
                    // menunjukkan peran yang sebenarnya.
                    const p = LABEL_PERAN[user.role] ?? { teks: user.role, warna: '#64748B' }
                    return (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        backgroundColor: `${p.warna}1F`, color: p.warna,
                        border: `1px solid ${p.warna}40`, whiteSpace: 'nowrap',
                      }}>
                        {p.teks}
                      </span>
                    )
                  })()}
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
                {!user.diriSendiri && (
                  <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => handleReset(user)}>
                    Reset PW
                  </Button>
                )}
                {user.diriSendiri ? (
                  <span style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)',
                  }}>
                    Akun Anda
                  </span>
                ) : (
                  <Button variant="danger" size="sm" style={{ flex: 1 }} onClick={() => handleDelete(user)}>Hapus</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Password sementara — hanya muncul sekali setelah reset berhasil */}
      <Modal
        open={pwSementara !== null}
        onClose={() => setPwSementara(null)}
        title="Password Sementara"
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
            Password untuk <b style={{ color: 'var(--text-primary)' }}>{pwSementara?.nama}</b> sudah
            diganti. Catat sekarang — password ini tidak disimpan dan tidak bisa dilihat lagi
            setelah dialog ditutup.
          </p>

          <div style={{
            padding: '14px 16px', borderRadius: 10, textAlign: 'center',
            backgroundColor: 'var(--bg-surface-2)', border: '1.5px dashed var(--border-strong)',
            fontFamily: 'monospace', fontSize: 22, fontWeight: 800,
            letterSpacing: '0.08em', color: 'var(--text-primary)', userSelect: 'all',
          }}>
            {pwSementara?.pw}
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.55 }}>
            Sampaikan langsung ke pemilik akun, dan minta dia menggantinya setelah berhasil masuk.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={() => setPwSementara(null)}>Sudah dicatat</Button>
          </div>
        </div>
      </Modal>

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

          <PasswordInput
            label={modalMode === 'add' ? 'Password *' : 'Ganti Password (Opsional)'}
            placeholder={modalMode === 'add' ? 'Minimal 8 karakter' : 'Kosongkan jika tidak ingin mengubah password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            hint={modalMode === 'add' ? 'Minimal 8 karakter, harus memuat huruf dan angka' : undefined}
          />

          {/* Peran menentukan bidang cakupan mana yang muncul di bawahnya.
              Pilihannya dibatasi peran akun yang sedang login. */}
          {peranBoleh.length > 1 && (
            <Select
              label="Peran *"
              value={peran}
              onChange={e => setPeran(e.target.value)}
              hint={
                peran === 'operator' ? 'Hanya melihat ULP yang dipilih di bawah'
                : peran === 'up3'    ? 'Melihat seluruh ULP di UP3 yang dipilih'
                : peran === 'uiw'    ? 'Melihat seluruh UP3 dan ULP di wilayahnya'
                : undefined
              }
            >
              {peranBoleh.map(r => (
                <option key={r} value={r}>{LABEL_ROLE[r] ?? r}</option>
              ))}
            </Select>
          )}

          {peran === 'up3' && (
            <Select label="UP3 *" value={up3Id} onChange={e => setUp3Id(e.target.value)}
              hint="Akun ini akan melihat semua ULP di UP3 tersebut">
              <option value="">— pilih UP3 —</option>
              {daftarUp3.map(u => <option key={u.id} value={u.id}>{u.nama} ({u.kode})</option>)}
            </Select>
          )}

          {peran === 'uiw' && (
            <Select label="UIW *" value={uiwId} onChange={e => setUiwId(e.target.value)}
              hint="Akun ini akan melihat semua UP3 dan ULP di wilayah tersebut">
              <option value="">— pilih UIW —</option>
              {daftarUiw.map(u => <option key={u.id} value={u.id}>{u.nama} ({u.kode})</option>)}
            </Select>
          )}

          <div style={{ display: peran === 'operator' ? 'block' : 'none' }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'block' }}>
              Pilih Cakupan ULP (Bisa lebih dari satu) <span style={{ color: '#E4002B' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {kelompokUlp.map(g => {
                const idsGrup = g.items.map(i => i.id)
                const semuaTerpilih = idsGrup.every(id => selectedUlps.includes(id))
                return (
                  <div key={g.kunci}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        🏭 {g.judul}
                      </span>
                      {/* Memilih seluruh ULP satu UP3 sekaligus — pola penugasan
                          yang lazim, dan menghemat belasan klik. */}
                      <button
                        type="button"
                        onClick={() => setSelectedUlps(prev => semuaTerpilih
                          ? prev.filter(id => !idsGrup.includes(id))
                          : [...new Set([...prev, ...idsGrup])])}
                        style={{
                          fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                          border: '1px solid var(--border)', backgroundColor: 'transparent',
                          color: 'var(--text-muted)', cursor: 'pointer',
                        }}
                      >
                        {semuaTerpilih ? 'Hapus semua' : 'Pilih semua'}
                      </button>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {idsGrup.filter(id => selectedUlps.includes(id)).length}/{idsGrup.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {g.items.map(ulp => {
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
