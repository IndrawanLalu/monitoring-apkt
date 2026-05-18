# Log Perubahan - 18 Mei 2026

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
