-- ============================================================
-- LANJUTAN index_skala.sql — buang duplikat & perbaiki satu index salah rancang
-- Jalankan di SQL Editor Supabase SETELAH index_skala.sql.
--
-- Tiap index harus diperbarui pada SETIAP insert dan update. Di volume ribuan
-- laporan per hari, index yang tidak pernah dipakai bukan sekadar mubazir —
-- ia memperlambat semua penulisan.
-- ============================================================

-- ── 1. Duplikat constraint unique ────────────────────────────
-- `unique` sudah otomatis membuat index sendiri, jadi index manual di kolom
-- yang sama tidak pernah terpakai dan hanya menambah beban tulis.
--   laporan.magic_token        → sudah ada laporan_magic_token_key
--   survey_laporan.laporan_id  → sudah ada survey_laporan_laporan_id_key
drop index if exists idx_laporan_magic_token;
drop index if exists idx_survey_laporan_id;

-- ── 2. Perbaikan index callback ──────────────────────────────
-- Versi pertama saya keliru: memakai (ulp_id, created_at), padahal query
-- callback di /rekap-laporan menyaring created_at + tanggal_callback SAJA,
-- tanpa ulp_id. Kolom pertama yang tidak disaring membuat index tak bisa
-- dipakai untuk range scan.
drop index if exists idx_laporan_callback;
create index if not exists idx_laporan_callback
  on laporan (created_at)
  where tanggal_callback is not null;

-- ── 3. Kandidat yang tumpang-tindih ──────────────────────────
-- JANGAN dijalankan membabi buta. Lihat dulu hasil query diagnostik di
-- bagian 4 — kolom idx_scan menunjukkan berapa kali index benar-benar dipakai
-- sejak statistik terakhir direset.
--
--   idx_laporan_ulp_id       → tercakup idx_laporan_ulp_created (ulp_id, created_at)
--                              karena kolom pertamanya sama
--   idx_laporan_status       → hanya 5 nilai berbeda, nyaris tidak menyaring
--   idx_laporan_resolved_piket_id → tumpang-tindih dgn idx_laporan_resolved_piket
--                              (ada di database tapi TIDAK ada di schema.sql)
--
-- Kalau idx_scan-nya 0 setelah aplikasi berjalan beberapa hari, baru buang:
-- drop index if exists idx_laporan_ulp_id;
-- drop index if exists idx_laporan_status;
-- drop index if exists idx_laporan_resolved_piket_id;

-- ── 4. Diagnostik ────────────────────────────────────────────
-- Pemakaian tiap index + ukurannya. idx_scan = 0 artinya belum pernah dipakai.
select
  s.relname                                as tabel,
  s.indexrelname                           as index,
  s.idx_scan                               as dipakai_berapa_kali,
  pg_size_pretty(pg_relation_size(s.indexrelid)) as ukuran,
  i.indexdef                               as definisi
from pg_stat_user_indexes s
join pg_indexes i
  on i.schemaname = s.schemaname
 and i.tablename  = s.relname
 and i.indexname  = s.indexrelname
where s.schemaname = 'public'
  and s.relname in ('laporan', 'survey_laporan')
order by s.idx_scan asc, pg_relation_size(s.indexrelid) desc;

-- Ukuran tabel vs total index — kalau index sudah lebih besar dari tabelnya,
-- itu tanda terlalu banyak index.
select
  relname as tabel,
  pg_size_pretty(pg_table_size(relid))   as ukuran_tabel,
  pg_size_pretty(pg_indexes_size(relid)) as ukuran_semua_index
from pg_stat_user_tables
where schemaname = 'public'
order by pg_total_relation_size(relid) desc;
