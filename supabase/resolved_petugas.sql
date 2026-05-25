-- Migration: tambah kolom resolved_petugas_names ke tabel laporan
-- Menyimpan snapshot nama-nama petugas regu yang menyelesaikan laporan.
-- Kolom ini diisi saat status berubah ke 'selesai' oleh API.
-- Tidak bergantung pada piket — data permanen meski piket dihapus.

ALTER TABLE laporan
  ADD COLUMN IF NOT EXISTS resolved_petugas_names text[] DEFAULT NULL;

-- Index untuk query di outage dashboard
CREATE INDEX IF NOT EXISTS idx_laporan_resolved_petugas ON laporan USING gin (resolved_petugas_names)
  WHERE resolved_petugas_names IS NOT NULL;
