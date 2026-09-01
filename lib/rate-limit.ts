/**
 * Pembatas laju sederhana berbasis memori, per proses.
 *
 * Cukup untuk deployment satu VPS satu instance PM2 (mode fork). Kalau nanti
 * dijalankan multi-instance, pindahkan ke Redis atau `limit_req_zone` Nginx —
 * hitungan ini tidak dibagi antar-proses.
 */

interface Jejak {
  hit: number[]
}

const jejak = new Map<string, Jejak>()
let terakhirBersih = Date.now()

/** Buang entri lama agar Map tidak tumbuh tanpa batas. */
function bersihkan(sekarang: number, jendelaMs: number) {
  if (sekarang - terakhirBersih < 60_000) return
  terakhirBersih = sekarang
  for (const [k, v] of jejak) {
    v.hit = v.hit.filter((t) => sekarang - t < jendelaMs)
    if (v.hit.length === 0) jejak.delete(k)
  }
}

export interface HasilRateLimit {
  lolos: boolean
  sisa: number
  /** Detik sampai kuota pulih — untuk header Retry-After. */
  cobaLagiDetik: number
}

/**
 * @param kunci   pengenal pemanggil, mis. `login:${ip}`
 * @param batas   jumlah percobaan maksimum dalam satu jendela
 * @param jendelaMs panjang jendela dalam milidetik
 */
export function rateLimit(kunci: string, batas: number, jendelaMs: number): HasilRateLimit {
  const sekarang = Date.now()
  bersihkan(sekarang, jendelaMs)

  const entri = jejak.get(kunci) ?? { hit: [] }
  entri.hit = entri.hit.filter((t) => sekarang - t < jendelaMs)

  if (entri.hit.length >= batas) {
    jejak.set(kunci, entri)
    const tertua = entri.hit[0]
    return {
      lolos: false,
      sisa: 0,
      cobaLagiDetik: Math.max(1, Math.ceil((jendelaMs - (sekarang - tertua)) / 1000)),
    }
  }

  entri.hit.push(sekarang)
  jejak.set(kunci, entri)
  return { lolos: true, sisa: batas - entri.hit.length, cobaLagiDetik: 0 }
}

/**
 * IP pemanggil. Di belakang Nginx, `request.ip` tidak tersedia di Next,
 * jadi dibaca dari header proxy. Header ini bisa dipalsukan kalau aplikasi
 * terekspos langsung ke internet — pastikan Nginx menimpanya, bukan meneruskan
 * apa adanya dari klien.
 */
export function ipPemanggil(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'tanpa-ip'
}
