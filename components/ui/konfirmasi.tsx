'use client'

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react'
import { Button } from './button'

/**
 * Dialog konfirmasi bersama, menggantikan window.confirm().
 *
 * Dipakai lewat hook imperatif supaya pemanggilnya tetap sesederhana confirm():
 *
 *   const konfirmasi = useKonfirmasi()
 *   if (!await konfirmasi({ judul: 'Hapus regu?', varian: 'danger' })) return
 *
 * Untuk aksi yang perlu menunggu jaringan, oper `aksi`. Dialog menjalankannya
 * sambil mengunci tombol dan menampilkan status — ini yang mencegah klik ganda
 * mengirim pesan WhatsApp dua kali, sesuatu yang tidak bisa dilakukan
 * window.confirm() karena aksinya berjalan setelah dialog tertutup.
 */

const DURASI_MS = 180

export interface Rincian {
  label: string
  nilai: string
}

export interface OpsiKonfirmasi {
  judul: string
  pesan?: string
  /** Baris ringkasan konteks, mis. Regu / Grup tujuan / Jumlah laporan. */
  rincian?: Rincian[]
  varian?: 'danger' | 'primary'
  labelAksi?: string
  labelBatal?: string
  /**
   * Kalau diisi, dialog yang menjalankannya: tombol terkunci dan berubah jadi
   * status kerja, lalu dialog menutup saat selesai. Kalau gagal, dialog tetap
   * terbuka dan menampilkan pesan errornya.
   */
  aksi?: () => Promise<void>
}

type Selesai = (hasil: boolean) => void

const KonfirmasiContext = createContext<((o: OpsiKonfirmasi) => Promise<boolean>) | null>(null)

export function useKonfirmasi() {
  const ctx = useContext(KonfirmasiContext)
  if (!ctx) throw new Error('useKonfirmasi harus dipakai di dalam <KonfirmasiProvider>')
  return ctx
}

function pakaiGerakDikurangi(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function KonfirmasiProvider({ children }: { children: React.ReactNode }) {
  const [opsi, setOpsi] = useState<OpsiKonfirmasi | null>(null)
  const [tampil, setTampil] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  const selesaiRef = useRef<Selesai | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const tombolBatalRef = useRef<HTMLButtonElement>(null)

  const minta = useCallback((o: OpsiKonfirmasi) => {
    setOpsi(o)
    setGalat(null)
    setSibuk(false)
    return new Promise<boolean>((resolve) => { selesaiRef.current = resolve })
  }, [])

  const tutup = useCallback((hasil: boolean) => {
    if (sibuk) return
    setTampil(false)
    selesaiRef.current?.(hasil)
    selesaiRef.current = null
    // Tunggu transisi keluar selesai baru dilepas dari DOM. Modal lama memakai
    // `if (!open) return null` sehingga animasi keluar mustahil.
    window.setTimeout(() => setOpsi(null), pakaiGerakDikurangi() ? 0 : DURASI_MS)
  }, [sibuk])

  async function jalankan() {
    if (!opsi) return
    if (!opsi.aksi) { tutup(true); return }

    setSibuk(true)
    setGalat(null)
    try {
      await opsi.aksi()
      setSibuk(false)
      setTampil(false)
      selesaiRef.current?.(true)
      selesaiRef.current = null
      window.setTimeout(() => setOpsi(null), pakaiGerakDikurangi() ? 0 : DURASI_MS)
    } catch (e) {
      setSibuk(false)
      setGalat(e instanceof Error ? e.message : 'Terjadi kesalahan. Coba lagi.')
    }
  }

  // Naikkan tirai setelah elemen ter-mount agar transisi punya keadaan awal.
  useEffect(() => {
    if (!opsi) return
    const id = requestAnimationFrame(() => setTampil(true))
    return () => cancelAnimationFrame(id)
  }, [opsi])

  // Esc menutup, Tab terkurung di dalam dialog, fokus awal di tombol batal
  // (aksi merusak tidak boleh bisa dipicu hanya dengan menekan Enter).
  useEffect(() => {
    if (!opsi) return
    tombolBatalRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); tutup(false); return }
      if (e.key !== 'Tab') return
      const fokusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
      if (!fokusable || fokusable.length === 0) return
      const awal = fokusable[0]
      const akhir = fokusable[fokusable.length - 1]
      if (e.shiftKey && document.activeElement === awal) { e.preventDefault(); akhir.focus() }
      else if (!e.shiftKey && document.activeElement === akhir) { e.preventDefault(); awal.focus() }
    }

    document.addEventListener('keydown', onKey)
    const overflowLama = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflowLama
    }
  }, [opsi, tutup])

  const durasi = pakaiGerakDikurangi() ? 0 : DURASI_MS
  const merusak = opsi?.varian === 'danger'

  return (
    <KonfirmasiContext.Provider value={minta}>
      {children}

      {opsi && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            aria-hidden="true"
            onClick={() => tutup(false)}
            style={{
              position: 'absolute', inset: 0,
              backgroundColor: 'rgba(2,6,23,0.55)',
              backdropFilter: 'blur(3px)',
              opacity: tampil ? 1 : 0,
              transition: `opacity ${durasi}ms ease`,
            }}
          />

          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="konfirmasi-judul"
            style={{
              position: 'relative',
              width: '100%', maxWidth: 420,
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              opacity: tampil ? 1 : 0,
              transform: tampil ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
              transition: `opacity ${durasi}ms ease, transform ${durasi}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          >
            {/* Pita warna sebagai penanda sifat aksi, sebelum teksnya dibaca. */}
            <div style={{ height: 4, backgroundColor: merusak ? '#E4002B' : 'var(--accent)' }} />

            <div style={{ padding: '20px 22px 18px' }}>
              <h2
                id="konfirmasi-judul"
                style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.35 }}
              >
                {opsi.judul}
              </h2>

              {opsi.pesan && (
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '8px 0 0' }}>
                  {opsi.pesan}
                </p>
              )}

              {opsi.rincian && opsi.rincian.length > 0 && (
                <dl style={{
                  margin: '14px 0 0', padding: '10px 12px',
                  backgroundColor: 'var(--bg-surface-2)',
                  border: '1px solid var(--border)', borderRadius: 10,
                  display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px',
                  fontSize: 12.5,
                }}>
                  {opsi.rincian.map((r) => (
                    <div key={r.label} style={{ display: 'contents' }}>
                      <dt style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{r.label}</dt>
                      <dd style={{ color: 'var(--text-primary)', fontWeight: 700, margin: 0, wordBreak: 'break-word' }}>
                        {r.nilai}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {galat && (
                <p role="alert" style={{
                  margin: '14px 0 0', padding: '9px 12px', borderRadius: 8,
                  backgroundColor: 'rgba(228,0,43,0.1)', border: '1px solid rgba(228,0,43,0.25)',
                  fontSize: 12.5, color: '#E4002B', fontWeight: 600, lineHeight: 1.5,
                }}>
                  {galat}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                <Button
                  ref={tombolBatalRef}
                  variant="secondary"
                  onClick={() => tutup(false)}
                  disabled={sibuk}
                >
                  {opsi.labelBatal ?? 'Batal'}
                </Button>
                <Button
                  variant={merusak ? 'danger' : 'primary'}
                  onClick={jalankan}
                  loading={sibuk}
                >
                  {sibuk ? 'Memproses…' : (opsi.labelAksi ?? (merusak ? 'Hapus' : 'Lanjutkan'))}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </KonfirmasiContext.Provider>
  )
}
