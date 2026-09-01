export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Scheduler kirim rekap gangguan belum selesai ke grup WA tiap 3 jam.
  // Jalan lepas dari jalur WA (gateway/legacy) — selalu diaktifkan saat boot.
  const { startRekapGangguanScheduler } = await import('./lib/wa/rekap-gangguan')
  startRekapGangguanScheduler()

  // Koneksi WA sepenuhnya dipegang wa-gateway (Baileys) sebagai proses terpisah.
  // Tidak ada sesi in-process yang perlu di-reconnect saat boot.
}
