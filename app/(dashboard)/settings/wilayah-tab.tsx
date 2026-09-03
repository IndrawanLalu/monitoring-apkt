'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useKonfirmasi } from '@/components/ui/konfirmasi'

/**
 * Kelola UIW dan UP3.
 *
 * Satu komponen untuk keduanya: bentuknya identik — nama, kode, dan sebuah
 * induk — hanya berbeda tingkat. Sebelumnya keduanya tidak bisa dikelola sama
 * sekali dari UI; UP3 yang ada dibuat lewat SQL manual.
 */

export interface ItemWilayah {
  id: string
  nama: string
  kode: string
  uiw_id?: string | null
  jumlahUlp?: number
  jumlahUp3?: number
}

interface Props {
  /** 'uiw' mengelola wilayah, 'up3' mengelola unit pelaksana di bawahnya. */
  tingkat: 'uiw' | 'up3'
  peranSaya: string
  onToast: (text: string, type?: 'success' | 'error' | 'info') => void
}

const TEKS = {
  uiw: {
    judul: 'Kelola UIW',
    satuan: 'UIW',
    keterangan: 'Unit Induk Wilayah — tingkat tertinggi. Setiap UP3 bernaung di bawah satu UIW.',
    anak: 'UP3',
    contohNama: 'UIW Nusa Tenggara Barat',
    contohKode: 'NTB',
  },
  up3: {
    judul: 'Kelola UP3',
    satuan: 'UP3',
    keterangan: 'Unit Pelaksana Pelayanan Pelanggan. Setiap ULP bernaung di bawah satu UP3.',
    anak: 'ULP',
    contohNama: 'UP3 Mataram',
    contohKode: 'MTR',
  },
} as const

export function WilayahTab({ tingkat, peranSaya, onToast }: Props) {
  const konfirmasi = useKonfirmasi()
  const router = useRouter()
  const t = TEKS[tingkat]

  const [items, setItems] = useState<ItemWilayah[]>([])
  const [daftarUiw, setDaftarUiw] = useState<ItemWilayah[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [terpilih, setTerpilih] = useState<ItemWilayah | null>(null)
  const [nama, setNama] = useState('')
  const [kode, setKode] = useState('')
  const [induk, setInduk] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [mengirim, setMengirim] = useState(false)

  // Super admin boleh menulis di kedua tingkat; admin UIW hanya di UP3.
  const bolehTulis = tingkat === 'uiw'
    ? peranSaya === 'super_admin'
    : peranSaya === 'super_admin' || peranSaya === 'uiw'

  // `loading` sudah true sejak awal, jadi tidak perlu di-set di sini —
  // menyentuh state secara sinkron di dalam effect memicu render bertingkat.
  const muat = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/${tingkat}`)
      const json = await res.json()
      setItems(res.ok ? (json.data ?? []) : [])
    } finally {
      setLoading(false)
    }
  }, [tingkat])

  useEffect(() => { muat() }, [muat])

  // Super admin harus memilih UIW induk saat membuat UP3; admin UIW tidak,
  // karena wilayahnya sudah pasti.
  useEffect(() => {
    if (tingkat !== 'up3' || peranSaya !== 'super_admin') return
    let batal = false
    fetch('/api/admin/uiw').then(r => r.json()).then(j => {
      if (!batal) setDaftarUiw(j.data ?? [])
    }).catch(() => null)
    return () => { batal = true }
  }, [tingkat, peranSaya])

  function bukaTambah() {
    setMode('add'); setTerpilih(null); setNama(''); setKode(''); setInduk(''); setGalat(null)
  }
  function bukaUbah(x: ItemWilayah) {
    setMode('edit'); setTerpilih(x); setNama(x.nama); setKode(x.kode)
    setInduk(x.uiw_id ?? ''); setGalat(null)
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault()
    setGalat(null)
    if (!nama.trim() || !kode.trim()) { setGalat('Nama dan kode wajib diisi'); return }
    if (mode === 'add' && tingkat === 'up3' && peranSaya === 'super_admin' && !induk) {
      setGalat('Pilih UIW induk untuk UP3 ini'); return
    }

    setMengirim(true)
    try {
      const url = mode === 'add' ? `/api/admin/${tingkat}` : `/api/admin/${tingkat}/${terpilih!.id}`
      const res = await fetch(url, {
        method: mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: nama.trim(), kode: kode.trim(), uiw_id: induk || undefined }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Gagal menyimpan')

      setItems(prev => mode === 'add' ? [...prev, json.data] : prev.map(x => x.id === terpilih!.id ? { ...x, ...json.data } : x))
      router.refresh()
      onToast(`${t.satuan} berhasil ${mode === 'add' ? 'dibuat' : 'diperbarui'}`, 'success')
      setMode(null)
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setMengirim(false)
    }
  }

  async function hapus(x: ItemWilayah) {
    const jml = tingkat === 'uiw' ? x.jumlahUp3 ?? 0 : x.jumlahUlp ?? 0
    const ok = await konfirmasi({
      judul: `Hapus ${t.satuan} ini secara permanen?`,
      pesan: jml > 0
        ? `Penghapusan akan ditolak karena ${t.satuan} ini masih memiliki ${jml} ${t.anak}.`
        : `${t.satuan} ini belum memiliki ${t.anak}, jadi aman dihapus.`,
      rincian: [{ label: t.satuan, nilai: `${x.nama} (${x.kode})` }],
      varian: 'danger',
      labelAksi: `Hapus ${t.satuan}`,
      aksi: async () => {
        const res = await fetch(`/api/admin/${tingkat}/${x.id}`, { method: 'DELETE' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error ?? 'Gagal menghapus')
      },
    })
    if (ok) {
      setItems(prev => prev.filter(i => i.id !== x.id))
      router.refresh()
      onToast(`${t.satuan} dihapus`, 'success')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{t.judul}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0', maxWidth: '60ch', lineHeight: 1.55 }}>
            {t.keterangan}
          </p>
        </div>
        {bolehTulis && <Button variant="primary" onClick={bukaTambah}>+ Tambah {t.satuan}</Button>}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Memuat…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 12, backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-muted)', fontSize: 13 }}>
          Belum ada {t.satuan}.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {items.map(x => {
            const jml = tingkat === 'uiw' ? x.jumlahUp3 ?? 0 : x.jumlahUlp ?? 0
            return (
              <div key={x.id} style={{
                backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 16, boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{x.nama}</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', fontFamily: 'monospace' }}>{x.kode}</p>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6,
                    backgroundColor: jml > 0 ? 'rgba(0,112,192,0.12)' : 'var(--bg-surface-2)',
                    color: jml > 0 ? 'var(--accent)' : 'var(--text-muted)',
                    border: '1px solid var(--border)', whiteSpace: 'nowrap',
                  }}>
                    {jml} {t.anak}
                  </span>
                </div>

                {bolehTulis && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => bukaUbah(x)}>Edit</Button>
                    <Button variant="danger" size="sm" style={{ flex: 1 }} onClick={() => hapus(x)}>Hapus</Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={mode !== null} onClose={() => setMode(null)} title={`${mode === 'add' ? 'Tambah' : 'Edit'} ${t.satuan}`} size="sm">
        <form onSubmit={simpan} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label={`Nama ${t.satuan} *`} placeholder={t.contohNama} value={nama} onChange={e => setNama(e.target.value)} />
          <Input
            label="Kode *"
            placeholder={t.contohKode}
            value={kode}
            onChange={e => setKode(e.target.value)}
            hint="Singkatan unik, otomatis jadi huruf besar"
          />

          {tingkat === 'up3' && peranSaya === 'super_admin' && mode === 'add' && (
            <Select label="UIW Induk *" value={induk} onChange={e => setInduk(e.target.value)}>
              <option value="">— pilih UIW —</option>
              {daftarUiw.map(u => <option key={u.id} value={u.id}>{u.nama} ({u.kode})</option>)}
            </Select>
          )}

          {galat && (
            <p style={{ fontSize: 12.5, color: '#E4002B', fontWeight: 600, margin: 0 }}>{galat}</p>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button variant="secondary" type="button" onClick={() => setMode(null)}>Batal</Button>
            <Button variant="primary" type="submit" loading={mengirim}>Simpan</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
