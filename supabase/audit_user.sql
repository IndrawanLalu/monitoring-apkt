-- ============================================================
-- JEJAK AUDIT AKUN PENGGUNA
-- Jalankan di SQL Editor Supabase. Aman diulang.
--
-- Sebelumnya tidak ada catatan sama sekali tentang siapa membuat, mengubah
-- peran, mereset password, atau menghapus akun. Untuk sistem yang memegang
-- data pelanggan seluruh ULP, pertanyaan "siapa yang memberi orang ini akses
-- UP3?" harus punya jawaban.
-- ============================================================

create table if not exists audit_user (
  id            uuid primary key default uuid_generate_v4(),
  aktor_id      uuid references auth.users(id) on delete set null,
  -- Nama disalin, bukan hanya di-referensi: pelakunya bisa saja dihapus
  -- kemudian, dan jejak audit yang kehilangan nama pelaku jadi tak berguna.
  aktor_nama    text not null,
  aksi          text not null,
  sasaran_id    uuid,
  sasaran_nama  text,
  keterangan    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_audit_user_created on audit_user (created_at desc);
create index if not exists idx_audit_user_sasaran on audit_user (sasaran_id);

-- Hanya service_role (admin client di server) yang boleh menulis maupun
-- membaca. Jejak audit yang bisa diubah pelakunya sendiri tidak ada gunanya.
alter table audit_user enable row level security;
revoke all on table audit_user from anon, authenticated;

-- ── Verifikasi ───────────────────────────────────────────────
select
  (select count(*) from audit_user) as jumlah_catatan,
  (select rowsecurity from pg_tables where schemaname='public' and tablename='audit_user') as rls_aktif;
