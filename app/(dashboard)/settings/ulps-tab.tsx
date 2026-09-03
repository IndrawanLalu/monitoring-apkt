'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useKonfirmasi } from '@/components/ui/konfirmasi'

interface UlpItem {
  id: string
  nama: string
  kode: string
  up3_id?: string | null
  /** Ikut dikirim server, jadi pengelompokan tidak menunggu fetch kedua. */
  up3?: { nama: string; kode: string } | null
  created_at: string
}

interface Up3Item { id: string; nama: string; kode: string }

interface Props {
  /** Peran akun yang login — super_admin & uiw memilih UP3 induk sendiri. */
  peranSaya: string
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void
}

export function UlpsTab({ peranSaya, onToast }: Props) {
  const konfirmasi = useKonfirmasi()
  const router = useRouter()

  // Daftar ULP juga dipakai tab lain lewat profile.ulps, yang diambil server
  // saat halaman dirender. Tanpa menyegarkannya, ULP yang baru dibuat di sini
  // tidak muncul di pemilih ULP pada Manajemen User sampai halaman dimuat
  // ulang — dan tidak ada petunjuk apa pun bahwa daftarnya sudah usang.
  function segarkanDataServer() {
    router.refresh()
  }
  const [ulps, setUlps] = useState<UlpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [selectedUlp, setSelectedUlp] = useState<UlpItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nama, setNama] = useState('')
  const [kode, setKode] = useState('')
  const [up3Id, setUp3Id] = useState('')
  const [daftarUp3, setDaftarUp3] = useState<Up3Item[]>([])

  // Akun 'up3' selalu membuat ULP di UP3-nya sendiri, jadi tidak perlu memilih.
  const pilihUp3 = peranSaya === 'super_admin' || peranSaya === 'uiw'

  // Diambil untuk SEMUA peran: selain jadi isi dropdown, namanya dipakai
  // sebagai judul kelompok di daftar ULP.
  useEffect(() => {
    let batal = false
    fetch('/api/admin/up3').then(r => r.json()).then(j => {
      if (!batal) setDaftarUp3(j.data ?? [])
    }).catch(() => null)
    return () => { batal = true }
  }, [pilihUp3])

  // ULP dikelompokkan menurut UP3 induknya. Untuk super_admin yang melihat
  // delapan ULP dari dua UP3, daftar rata sulit dibaca — dan hubungan
  // hierarkinya, yang justru inti halaman ini, jadi tidak terlihat.
  const kelompok = useMemo(() => {
    const peta = new Map<string, { kunci: string; judul: string; items: UlpItem[] }>()
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

  const fetchUlps = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ulps')
      const json = await res.json()
      if (res.ok && json.data) setUlps(json.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUlps() }, [fetchUlps])

  function openAdd() {
    setModalMode('add')
    setSelectedUlp(null)
    setNama('')
    setKode('')
    setUp3Id('')
    setError(null)
  }

  function openEdit(ulp: UlpItem) {
    setModalMode('edit')
    setSelectedUlp(ulp)
    setNama(ulp.nama)
    setKode(ulp.kode)
    setUp3Id(ulp.up3_id ?? '')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nama.trim()) { setError('Nama ULP wajib diisi'); return }
    if (!kode.trim()) { setError('Kode ULP wajib diisi'); return }
    if (pilihUp3 && modalMode === 'add' && !up3Id) { setError('Pilih UP3 induk untuk ULP ini'); return }

    setSubmitting(true)
    try {
      if (modalMode === 'add') {
        const res = await fetch('/api/admin/ulps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama: nama.trim(), kode: kode.trim(), up3_id: up3Id || undefined }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error ?? 'Gagal membuat ULP')
        setUlps(prev => [...prev, json.data].sort((a, b) => a.nama.localeCompare(b.nama)))
        segarkanDataServer()
        onToast('ULP berhasil dibuat. Muat ulang halaman untuk melihat perubahan di menu.', 'success')
      } else if (modalMode === 'edit' && selectedUlp) {
        const res = await fetch(`/api/admin/ulps/${selectedUlp.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nama: nama.trim(), kode: kode.trim(),
            // Hanya dikirim kalau memang boleh dipilih; peran 'up3' tidak
            // menampilkan bidangnya dan server menolaknya kalau tetap dikirim.
            up3_id: pilihUp3 ? (up3Id || undefined) : undefined,
          }),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error ?? 'Gagal update ULP')
        setUlps(prev => prev.map(u => u.id === selectedUlp.id ? json.data : u).sort((a, b) => a.nama.localeCompare(b.nama)))
        segarkanDataServer()
        onToast('ULP berhasil diupdate', 'success')
      }
      setModalMode(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(ulp: UlpItem) {
    const ok = await konfirmasi({
      judul: 'Hapus ULP secara permanen?',
      pesan: 'Penghapusan akan ditolak kalau ULP ini masih punya regu atau laporan.',
      rincian: [{ label: 'ULP', nilai: `${ulp.nama} (${ulp.kode})` }],
      varian: 'danger',
      labelAksi: 'Hapus ULP',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/admin/ulps/${ulp.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Gagal menghapus ULP')
      setUlps(prev => prev.filter(u => u.id !== ulp.id))
      segarkanDataServer()
      onToast('ULP berhasil dihapus', 'success')
    } catch (err: any) {
      onToast(err.message, 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🏢 Kelola ULP</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Tambah atau kelola Unit Layanan Pelanggan (ULP) di bawah UP3 Anda.
          </p>
        </div>
        <Button variant="primary" onClick={openAdd}>+ Tambah ULP Baru</Button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Memuat data ULP...</div>
      ) : ulps.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 12, backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-muted)', fontSize: 13 }}>
          Belum ada ULP. Klik &quot;+ Tambah ULP Baru&quot; untuk menambahkan.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {kelompok.map(g => (
            <section key={g.kunci}>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 10,
                paddingBottom: 8, marginBottom: 12,
                borderBottom: '1.5px solid var(--border)',
              }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  🏭 {g.judul}
                </h3>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>
                  {g.items.length} ULP
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {g.items.map(ulp => (
            <div key={ulp.id} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12, boxShadow: 'var(--shadow-sm)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 6, backgroundColor: 'rgba(0,112,192,0.1)', color: '#0070C0', border: '1px solid rgba(0,112,192,0.2)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                    {ulp.kode}
                  </span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{ulp.nama}</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Dibuat: {new Date(ulp.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => openEdit(ulp)}>Edit</Button>
                <Button variant="danger" size="sm" style={{ flex: 1 }} onClick={() => handleDelete(ulp)}>Hapus</Button>
              </div>
            </div>
          ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal open={!!modalMode} onClose={() => setModalMode(null)} title={modalMode === 'add' ? 'Tambah ULP Baru' : 'Edit ULP'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Nama ULP *"
            placeholder="ULP Ampenan"
            value={nama}
            onChange={e => setNama(e.target.value)}
          />
          <Input
            label="Kode ULP *"
            placeholder="AMP"
            value={kode}
            onChange={e => setKode(e.target.value.toUpperCase())}
            hint="Kode singkat unik, contoh: AMP, TJG, MTR"
          />

          {/* UP3 induk hanya perlu dipilih oleh super_admin dan admin UIW.
              Akun 'up3' selalu membuat ULP di UP3-nya sendiri, jadi bidang ini
              tidak ditampilkan dan diabaikan server kalau tetap dikirim. */}
          {pilihUp3 && (
            <Select
              label="UP3 Induk *"
              value={up3Id}
              onChange={e => setUp3Id(e.target.value)}
              hint={modalMode === 'edit'
                ? 'Mengubah ini memindahkan ULP beserta seluruh data operasionalnya'
                : 'ULP ini akan bernaung di bawah UP3 tersebut'}
            >
              <option value="">— pilih UP3 —</option>
              {daftarUp3.map(u => <option key={u.id} value={u.id}>{u.nama} ({u.kode})</option>)}
            </Select>
          )}

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
