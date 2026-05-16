-- Tambah kolom resolved_piket_id ke laporan
-- Diisi saat status diubah ke 'selesai', berisi piket yang aktif saat itu

ALTER TABLE laporan
  ADD COLUMN IF NOT EXISTS resolved_piket_id uuid REFERENCES piket(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_laporan_resolved_piket_id ON laporan(resolved_piket_id);
