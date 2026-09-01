-- ============================================================
-- INDEX untuk skala ribuan laporan per hari
-- Jalankan di SQL Editor Supabase. Aman diulang (IF NOT EXISTS).
--
-- Index lama semuanya kolom tunggal, sementara semua query panas memakai
-- kombinasi. Yang paling terasa: `status` hanya punya 5 nilai berbeda,
-- sehingga index tunggal di atasnya nyaris tidak menyaring apa pun.
-- ============================================================

-- ── Laporan yang BELUM selesai ───────────────────────────────
-- Sengaja PARTIAL. Hampir semua baris pada akhirnya berstatus 'selesai',
-- jadi index yang hanya memuat baris terbuka tetap kecil selamanya —
-- puluhan sampai ratusan baris — walau tabelnya tumbuh jutaan.
-- Dipakai: /api/antrian/[token] (endpoint terpanas, di-polling pelanggan),
-- lib/wa/send.ts (nomor antrian), /api/wa/kirim-regu.
create index if not exists idx_laporan_regu_terbuka
  on laporan (regu_id, created_at)
  where status <> 'selesai';

-- Dipakai: dashboard, rekap gangguan, rekap serah terima.
create index if not exists idx_laporan_ulp_terbuka
  on laporan (ulp_id, created_at)
  where status <> 'selesai';

-- ── Laporan yang SUDAH selesai ───────────────────────────────
-- Dipakai: halaman Outage (rentang bulanan) dan dashboard (selesai hari ini).
-- resolved_at sebelumnya TIDAK punya index sama sekali.
create index if not exists idx_laporan_ulp_resolved
  on laporan (ulp_id, resolved_at desc)
  where resolved_at is not null;

-- Dipakai: hitungan "Selesai" per sesi piket di rekap serah terima & rekap
-- gangguan. Kolom ini juga sebelumnya tanpa index.
create index if not exists idx_laporan_resolved_piket
  on laporan (resolved_piket_id)
  where resolved_piket_id is not null;

-- ── Daftar laporan harian ────────────────────────────────────
-- Dipakai: /laporan yang difilter per tanggal per ULP.
create index if not exists idx_laporan_ulp_created
  on laporan (ulp_id, created_at desc);

-- ── Callback ─────────────────────────────────────────────────
-- Dipakai: hitungan callback harian & bulanan di /rekap-laporan.
-- Sengaja TANPA ulp_id di depan: query-nya menyaring created_at +
-- tanggal_callback saja, tanpa ulp_id. Kolom pertama yang tidak disaring
-- membuat index tak bisa dipakai untuk range scan.
-- (Diperbaiki di index_skala_2_bersihkan.sql — versi pertama file ini keliru.)
create index if not exists idx_laporan_callback
  on laporan (created_at)
  where tanggal_callback is not null;

-- ── Survey ───────────────────────────────────────────────────
-- Dipakai: /rekap-survey dan hitungan survey di /rekap-laporan, keduanya
-- menyaring berdasarkan submitted_at yang sebelumnya tanpa index.
create index if not exists idx_survey_submitted
  on survey_laporan (submitted_at desc);

-- ── Verifikasi ───────────────────────────────────────────────
-- Pastikan tabel yang dipakai bersama juga berpagar RLS (temuan audit K4).
select tablename, rowsecurity as rls_aktif
from pg_tables
where schemaname = 'public'
order by rowsecurity, tablename;

-- Daftar index yang sekarang ada di tabel laporan & survey.
select tablename, indexname
from pg_indexes
where schemaname = 'public' and tablename in ('laporan', 'survey_laporan')
order by tablename, indexname;
