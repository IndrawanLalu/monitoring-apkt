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
