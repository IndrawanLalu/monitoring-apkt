# Log Perubahan - 19 Mei 2026

## 7. Rekap Laporan: UI Revision + UP3 Grouping + Fix Survey Count

### Perubahan UI (`app/rekap-laporan/rekap-client.tsx`)

**Status dikelompokkan jadi 3 grup** (konsisten dengan dashboard):
- **Dalam Antrian** = `lapor + penugasan_regu + nyala_sementara`
- **Sedang Ditangani** = `ditangani`
- **Selesai** = `selesai`

Berlaku di: BigStat header, GroupChips di ULP/Regu, badge status di tiap laporan aktif (`LaporanList`).

**Card Callback + Survey digabung satu baris** — satu card dua kolom (biru kiri, hijau kanan), 4 stat box: Callback Hari Ini | Callback Bulan Ini | Survey Hari Ini | Survey Bulan Ini. Selalu tampil meski nilai 0.

**UP3 selector di header**:
- Dropdown `<select>` jika ada 2+ UP3 (migration sudah dijalankan)
- Badge label statis jika hanya 1 UP3
- Tidak tampil jika migration belum dijalankan (`up3Nama` kosong)

**Fix hydration error mobile** — `rekap-client-wrapper.tsx` (`'use client'`) membungkus `RekapClient` via `next/dynamic` dengan `ssr: false`. Diperlukan karena `page.tsx` adalah Server Component sehingga tidak bisa langsung pakai `ssr: false`.

### Fix Survey Count Bug (`app/rekap-laporan/page.tsx`)

**Root cause**: Survey dihitung lewat `laporanUlpMap`, tapi map itu hanya berisi laporan aktif + laporan selesai **hari ini**. Survey dari laporan yang diselesaikan hari-hari sebelumnya tidak bisa di-resolve ke `ulp_id` → di-skip → count = 0.

**Fix**: Query `survey_laporan` sekarang join langsung ke tabel `laporan` untuk ambil `ulp_id`:
```typescript
supabase.from('survey_laporan')
  .select('laporan_id, submitted_at, laporan:laporan_id(ulp_id)')
  .gte('submitted_at', startOfMonth)
```
Agregasi survey pakai `(s.laporan as any)?.ulp_id` dengan fallback ke `laporanUlpMap`.

### UP3 Frontend Management (`app/(dashboard)/settings/`)

**Tab baru "Kelola ULP"** — hanya muncul jika `profile.role === 'admin'` dan `profile.up3_id` non-null.
- `ulps-tab.tsx`: CRUD ULP (Add/Edit/Delete) via API
- `app/api/admin/ulps/route.ts`: GET + POST, scoped ke `up3_id` admin
- `app/api/admin/ulps/[id]/route.ts`: PATCH + DELETE, guard `verifyUlpAccess`
- DELETE diblokir jika ULP masih punya regu atau laporan

**Backwards-compatible auth** (`lib/auth.ts`): `up3_id` di-fetch lewat query terpisah `.maybeSingle()` agar tidak crash jika kolom belum ada (pre-migration).

### Prasyarat
- Jalankan `supabase/migration_up3.sql` di Supabase SQL Editor untuk aktifkan fitur UP3 grouping dan Kelola ULP.

---

# Log Perubahan - 18 Mei 2026

## 6. Fix VPS: Multi-WA Simultaneous + PM2 Startup

### Root Cause: Snap Chromium Shared SingletonLock
Ketika 2 user berbeda mencoba connect WA bersamaan, salah satu mendapat error **"browser already running"**. Investigasi panjang menemukan penyebab utama:

- **Snap Chromium** meletakkan `SingletonLock` di direktori shared:
  `/home/indrawansaputra/snap/chromium/common/chromium/SingletonLock`
  — **bukan** di folder session per-user (`wa-sessions/session-user-{userId}`)
- Akibatnya: Chrome user pertama (snap) menaruh lock di shared dir → Chrome user kedua (juga snap) menemukan lock itu → error "browser already running" meski session folder berbeda
- Akar masalah: `CHROME_PATH` tidak ter-inject ke environment PM2 (PM2 tidak otomatis baca `.env`) → Chrome fallback ke snap Chromium dari `$PATH`

### Perbaikan

**VPS `.env`**
- Ubah `CHROME_PATH=/usr/bin/google-chrome` → `CHROME_PATH=/opt/google/chrome/google-chrome`
- Path langsung ke binary Google Chrome (bukan rantai symlink, bukan snap)

**PM2 environment**
- Inject CHROME_PATH ke PM2 process: `CHROME_PATH=/opt/google/chrome/google-chrome pm2 restart monitoring-apkt --update-env`
- Verifikasi: `pm2 env 0 | grep CHROME` harus menampilkan path yang benar

**PM2 Startup (systemd)**
- Konfigurasi `pm2 startup` → systemd service `pm2-indrawansaputra.service`
- `pm2 save` untuk simpan state — PM2 dan aplikasi otomatis start saat VPS reboot

### Pelajaran Penting

**LARANGAN: `fuser -km <path>`**
- Flag `-m` di `fuser` memperlakukan path sebagai referensi filesystem mount → SIGKILL ke **semua** proses di root filesystem (PM2, Node.js, SSH daemon — semuanya mati)
- Sudah dihapus dari `lib/wa/client.ts`

**Snap Chromium vs Google Chrome**
- Snap Chromium: child processes SELALU pakai shared dir `/home/user/snap/chromium/common/chromium/` sebagai user-data-dir, mengabaikan flag `--user-data-dir` → SingletonLock di shared dir → konflik multi-user
- Google Chrome (`/opt/google/chrome/google-chrome`): lock ditempatkan di folder session yang benar → tidak ada konflik

**Kill Chrome zombie yang aman (`lib/wa/client.ts`)**
1. Baca `SingletonLock` → ambil PID → `process.kill(pid, 'SIGKILL')` dari Node.js langsung
2. Fallback: `pkill -9 -f "[s]ession-user-${userId}"` — `[s]` trick mencegah pkill match cmdline subprocess-nya sendiri

### Recovery Darurat WA Bermasalah di VPS
```bash
pkill -9 -f chromium; pkill -9 -f google-chrome
rm -rf /var/www/monitoring-apkt/wa-sessions/session-user-*
rm -f /home/indrawansaputra/snap/chromium/common/chromium/SingletonLock
CHROME_PATH=/opt/google/chrome/google-chrome pm2 restart monitoring-apkt --update-env
```

### Catatan Operasional (update)
- Catatan lama di bagian ## 4 tentang `pkill -f chromium` diganti dengan perintah di atas (lebih lengkap dan aman)
- Jangan gunakan snap Chromium untuk WA di VPS — pastikan `pm2 env 0 | grep CHROME` selalu menampilkan `/opt/google/chrome/google-chrome`

---

## 5. Dashboard: ULP Chip Selector + Badge Notif Laporan Baru

### Perubahan
**`app/(dashboard)/dashboard/dashboard-client.tsx`**
- Ganti tampilan multi-ULP stacked (2 ULP masing-masing 50% tinggi layar) menjadi **chip selector** tipis di atas dashboard.
- Hanya ULP yang dipilih yang ditampilkan, menempati penuh sisa tinggi layar — tampilan lebih lega.
- Badge merah muncul di chip ULP yang sedang tidak ditampilkan jika ada laporan baru masuk via realtime.
- Realtime tetap subscribe ke **semua ULP** pengguna — data tidak hilang saat pindah ULP.
- Gunakan `useRef` untuk track `selectedUlpIdx` di dalam `handleRealtimeInsert` tanpa menambah deps useCallback (mencegah resubscribe channel realtime).
- Chip selector hanya tampil jika user punya >1 ULP (konsisten dengan Settings).

---

## 4. Fix WA Connection: Chrome Zombie, Auto-Reconnect, dan Kompatibilitas

### Masalah yang Ditemukan
1. **Chrome zombie**: Saat `wa_session` dikosongkan manual di Supabase (bukan lewat `/disconnect`), proses Chrome tetap jalan di VPS. Init berikutnya gagal dengan *"browser already running"*.
2. **Auto-reconnect loop**: `instrumentation.ts` mencoba reconnect saat server start untuk semua session dengan status `connected`. Kalau folder session tidak ada (sudah dihapus manual), Chrome gagal start lalu error `auth timeout` terus-menerus.
3. **State tidak sinkron**: `isClientRegistered` masih `true` dari run sebelumnya → event handler `qr`/`ready` tidak di-register ulang → init baru tidak pernah memicu QR.
4. **Kompatibilitas WhatsApp Web**: Flag `--disable-web-security` menyebabkan WA Web navigate ke error page → error `Execution context was destroyed`.

### Perbaikan

**`app/api/wa/init/route.ts`**
- Tambah `await destroyWaClient(userId)` sebelum `getOrCreateWaClient` agar state selalu bersih setiap kali user tekan "Hubungkan".

**`lib/wa/client.ts`**
- `destroyWaClient` kini membaca `SingletonLock` file untuk kill Chrome via PID, plus fallback `pkill -f "session-user-{userId}"` untuk kill zombie process.
- Tambah `hasWaSession(userId)` — helper cek apakah folder session lokal ada.
- Tambah `userAgent` Chrome agar WA Web tidak deteksi headless browser.
- Hapus flag `--disable-web-security` dan `--allow-running-insecure-content` yang merusak security model WA Web.
- Tambah flag `--disable-features=site-per-process`.

**`instrumentation.ts`**
- Sebelum auto-reconnect, cek `hasWaSession(user_id)` — kalau folder tidak ada, set status `disconnected` di DB dan skip.
- Error handler auto-reconnect kini memanggil `destroyWaClient` untuk cleanup.

### Catatan Operasional WA di VPS
- Jangan hapus `wa_session` di Supabase secara manual — gunakan tombol "Putuskan Koneksi" di Settings agar Chrome ikut di-kill dan folder session ikut dihapus.
- Kalau terpaksa hapus manual, jalankan di VPS: `pkill -f chromium && rm -rf wa-sessions/session-user-* && pm2 restart monitoring-apkt`
- WA session tersimpan per `user_id` (bukan `ulp_id`) di folder `wa-sessions/session-user-{userId}`.
- Satu user bisa kirim WA ke group manapun selama nomor WA-nya terdaftar di group tersebut.

### Status Saat Ini (17 Mei 2026)
- Error `Execution context was destroyed` masih dalam investigasi — kemungkinan `whatsapp-web.js@1.34.7` perlu `webVersionCache` untuk pin versi WA Web yang stabil.

---

# Log Perubahan - 17 Mei 2026

## 3. Fix Multi-ULP: Dashboard, Callback, Settings, Navbar

### Masalah yang Ditemukan
- Dashboard hanya menampilkan data 1 ULP karena RLS Supabase (`get_my_ulp_id()`) hanya mengembalikan 1 ULP dari kolom `profiles.ulp_id`, sementara akses multi-ULP disimpan di tabel `user_ulp`.
- Laporan dari halaman Callback tersimpan dengan `ulp_id` yang salah (dari cookie `active_ulp_id`) tapi `regu_id` dari ULP lain → data tidak muncul di regu card manapun.
- Settings hanya menampilkan data ULP pertama, tidak bisa kelola ULP kedua.
- Navbar punya dropdown switch ULP yang menjadi sumber kebingungan.

### Perbaikan

**`app/(dashboard)/dashboard/page.tsx`**
- Ganti `createClient()` → `createAdminClient()` agar query piket, regu, laporan, dan `piket_petugas` tidak terblokir RLS.
- Hapus cek `petugasList.length > 0` yang menyebabkan ULP tanpa petugas di-assign dianggap "tidak ada piket aktif".

**`app/(dashboard)/dashboard/dashboard-client.tsx`**
- Regu cards selalu tampil selama ada regu terdaftar, tidak lagi bergantung pada `piket !== null`.
- Tombol "Tambah Laporan" memakai `piket?.id ?? null` agar aman saat piket kosong.

**`app/(dashboard)/callback/callback-client.tsx`**
- `ulp_id` laporan sekarang diambil dari `selectedRegu.ulp_id`, bukan dari cookie `active_ulp_id`.
- Variabel `{ulp}` di template WA mengikuti nama ULP dari regu yang dipilih.
- Berlaku juga untuk fungsi `bukaWa()` dan layar Done.

**`components/layout/navbar.tsx`**
- Hapus dropdown switch ULP beserta fungsi `handleSwitchUlp` dan state `switchingUlp`.
- Diganti teks statis yang menampilkan semua nama ULP user (contoh: "Ampenan & Tanjung").

**`app/(dashboard)/settings/page.tsx`**
- Load data regu, petugas, wa_template_callback, dan wa_grup_id untuk **semua ULP** sekaligus menggunakan `createAdminClient()`.
- Tidak lagi bergantung pada `profile.activeUlp`.

**`app/(dashboard)/settings/settings-client.tsx`**
- Tambah **ULP selector chip** di atas tab bar (hanya muncul jika user punya >1 ULP).
- State `ulpStates[]` menyimpan reguList, petugasList, waGrupId per ULP secara terpisah.
- Semua tab (WA, Regu, Petugas, Template Callback) otomatis menampilkan data ULP yang dipilih.
- `CallbackTemplateTab` diberi `key={current.ulp.id}` agar re-mount saat ganti ULP.

### Arsitektur Multi-ULP
- `getProfile()` di `lib/auth.ts` memakai `createAdminClient()` → membaca `user_ulp` → mengembalikan `profile.ulps[]` (semua ULP yang diizinkan).
- Halaman server-side yang perlu data multi-ULP harus memakai `createAdminClient()` dan filter manual dengan `ulpIds = profile.ulps.map(u => u.id)`.
- RLS `get_my_ulp_id()` di `supabase/schema.sql` hanya mengembalikan 1 ULP dari `profiles.ulp_id` — **jangan andalkan ini untuk query multi-ULP**. Gunakan `get_my_ulp_ids()` dari `supabase/fix_rls_multi_ulp.sql` (sudah dijalankan di Supabase) atau pakai admin client di server component.

---

# Log Perubahan - 16 Mei 2026

## 1. Fitur Survey Kepuasan Pelanggan (Halaman Antrian)
*   **Database**: Menambahkan tabel baru `survey_laporan` untuk menyimpan hasil survey pelanggan yang terhubung dengan `laporan_id` secara unik (1 laporan = 1 survey). Script SQL disimpan di `supabase/survey_laporan.sql`.
*   **API Pembaruan**:
    *   Memperbarui `app/api/antrian/[token]/route.ts` untuk mengembalikan status `surveyDone`, `namaPelanggan`, dan `alamat`.
    *   Membuat API baru `app/api/antrian/[token]/survey/route.ts` untuk menangani pengiriman (*submit*) data survey.
*   **UI/UX Halaman Antrian (`app/antrian/[token]/antrian-client.tsx`)**:
    *   Mengubah ikon live chat menjadi `live-chat.png` menggunakan tag `<img>` standar untuk menghindari error validasi format gambar dari Next.js.
    *   Menambahkan alur baru: Setelah status gangguan berubah menjadi `selesai`, pelanggan akan diminta mengisi survey.
    *   Form survey dibuat persis sesuai dengan Google Form yang ada:
        *   Data laporan (hanya menampilkan Nomor Lapor).
        *   Q1: Kondisi setelah perbaikan.
        *   Q2 & Q3: Kualitas dan Kecepatan (skala 1-5).
        *   Q4 - Q9: Pertanyaan Ya/Tidak (Pungli, Tips, 3S, Identitas, APD, Hal tidak menyenangkan).
        *   Q10: Kepuasan keseluruhan (menggunakan rating Emoji).
        *   Q11: Saran/Pesan opsional.
    *   **Keamanan/Expired Token**: Setelah survey diisi, halaman akan menampilkan pesan "Terima Kasih" dan tidak dapat diakses lagi (token dianggap kedaluwarsa).

## 2. Fitur Halaman Outage Report (`/outage`)
*   **Akses & Navigasi**:
    *   Mengecualikan route `/outage` dari `PiketGuard` (`components/layout/piket-guard.tsx`) sehingga halaman ini dapat diakses tanpa harus memiliki shift aktif.
    *   Menambahkan menu "Outage" ke `Navbar`.
*   **Pengolahan Data (`app/(dashboard)/outage/page.tsx`)**:
    *   Data ditampilkan berdasarkan filter Bulan, Tahun, dan ULP.
    *   Data disaring sesuai dengan ULP yang di-assign ke akun yang sedang login (UP3 masing-masing).
*   **UI/UX Dashboard Outage (`app/(dashboard)/outage/outage-client.tsx`)**:
    *   Membangun dashboard dengan 4 tab utama:
        1.  **⭐ Rating Puas**: Menampilkan daftar nama petugas dengan perolehan rating "Sangat Puas" terbanyak dari survey (dilengkapi ikon medali).
        2.  **✅ Kinerja Petugas**: Menampilkan grafik/list nama petugas dengan jumlah gangguan berstatus "selesai" terbanyak (Top 5) dan tersedikit (Bottom 5).
        3.  **📋 Daftar Survey**: Menampilkan daftar gangguan yang telah disurvey oleh pelanggan (termasuk nomor tiket, ULP, lokasi, nama petugas, status kepuasan, dan tanggal).
        4.  **📅 Kalender**: Menampilkan kalender bulanan interaktif. Setiap tanggal menunjukkan total gangguan selesai dan rincian jumlah gangguan yang diselesaikan oleh masing-masing petugas pada hari tersebut.
