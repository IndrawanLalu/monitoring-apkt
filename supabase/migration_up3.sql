-- ============================================================
-- MIGRATION: Tambah tabel UP3 dan relasi ke ULP + profiles
-- Jalankan di SQL Editor Supabase
-- ============================================================

-- 1. Buat tabel up3
CREATE TABLE IF NOT EXISTS up3 (
  id          uuid primary key default uuid_generate_v4(),
  nama        text not null,
  kode        text not null unique,
  created_at  timestamptz not null default now()
);

-- 2. Tambah kolom up3_id ke tabel ulp
ALTER TABLE ulp ADD COLUMN IF NOT EXISTS up3_id uuid references up3(id) on delete restrict;

-- 3. Tambah kolom up3_id ke tabel profiles (admin terikat ke 1 UP3)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS up3_id uuid references up3(id) on delete restrict;

-- 4. Seed data UP3
INSERT INTO up3 (nama, kode) VALUES ('UP3 Mataram', 'MTR') ON CONFLICT (kode) DO NOTHING;

-- 5. Hubungkan semua ULP yang ada ke UP3 Mataram
UPDATE ulp SET up3_id = (SELECT id FROM up3 WHERE kode = 'MTR') WHERE up3_id IS NULL;

-- 6. Hubungkan semua akun admin ke UP3 Mataram
UPDATE profiles SET up3_id = (SELECT id FROM up3 WHERE kode = 'MTR')
WHERE role = 'admin' AND up3_id IS NULL;

-- Verifikasi hasil
SELECT u.nama AS ulp_nama, p.nama AS up3_nama
FROM ulp u
JOIN up3 p ON u.up3_id = p.id
ORDER BY p.nama, u.nama;
