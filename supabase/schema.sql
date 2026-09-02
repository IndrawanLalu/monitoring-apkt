-- ⚠ BERKAS INI TIDAK LAGI MENGGAMBARKAN DATABASE YANG BERJALAN.
--
-- Terverifikasi berbeda di empat titik: tabel user_ulp tidak ada di sini,
-- profiles.ulp_id sudah dihapus dari database, laporan.regu_id nyatanya
-- nullable, dan beberapa index hanya ada di database.
--
-- Urutan berkas yang benar untuk membangun ulang:
--   1. schema.sql (ini)          — tabel dasar
--   2. survey_laporan.sql
--   3. migration_up3.sql
--   4. peran_1_enum.sql          — WAJIB dijalankan sendiri
--   5. peran_2_struktur.sql      — UIW, peran baru, RLS yang berlaku
--   5b. peran_3_bootstrap.sql   — pembagian ULP per UP3 + super_admin pertama
--   6. index_skala.sql + index_skala_2_bersihkan.sql
--   7. rekap_outage.sql
--
-- Bagian RLS di bawah SUDAH DIGANTI oleh peran_2_struktur.sql. Jangan
-- dijalankan sendirian — policy di sini memakai get_my_ulp_id() yang
-- membaca profiles.ulp_id, kolom yang sudah tidak ada.
--
-- Cara menyehatkannya sekali jalan: `pg_dump --schema-only` dari database
-- yang berjalan, lalu simpan hasilnya menggantikan berkas ini.
-- ============================================================

-- ============================================================
-- MONITORING APKT — Database Schema (Idempotent / Safe Migration)
-- Aman dijalankan di database yang sudah ada sebagian tabelnya
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── ENUMS (safe create) ─────────────────────────────────────

do $$ begin
  create type status_laporan as enum ('lapor', 'ditangani', 'nyala_sementara', 'selesai');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin', 'supervisor', 'cc');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shift_nama as enum ('pagi', 'sore', 'malam');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wa_status as enum ('connected', 'disconnected', 'scanning', 'loading');
exception when duplicate_object then null; end $$;

do $$ begin
  create type updated_by_type as enum ('cc', 'petugas', 'system');
exception when duplicate_object then null; end $$;

-- ─── ULP ─────────────────────────────────────────────────────

create table if not exists ulp (
  id          uuid primary key default uuid_generate_v4(),
  nama        text not null,
  kode        text not null unique,
  wa_grup_id  text,
  created_at  timestamptz not null default now()
);

-- ─── REGU ────────────────────────────────────────────────────

create table if not exists regu (
  id          uuid primary key default uuid_generate_v4(),
  ulp_id      uuid not null references ulp(id) on delete cascade,
  nama        text not null,
  created_at  timestamptz not null default now(),
  unique(ulp_id, nama)
);

-- ─── PETUGAS APKT ────────────────────────────────────────────
-- Tabel petugas khusus aplikasi ini (nama petugas field untuk keperluan rekap/WA)

create table if not exists petugas_apkt (
  id          uuid primary key default uuid_generate_v4(),
  ulp_id      uuid not null references ulp(id) on delete cascade,
  regu_id     uuid not null references regu(id) on delete cascade,
  nama        text not null,
  nomor_hp    text,
  created_at  timestamptz not null default now()
);

-- ─── SHIFT TYPE ──────────────────────────────────────────────

create table if not exists shift_type (
  id          uuid primary key default uuid_generate_v4(),
  nama        shift_nama not null unique,
  jam_mulai   time not null,
  jam_selesai time not null
);

-- Seed shift types (skip jika sudah ada)
insert into shift_type (nama, jam_mulai, jam_selesai) values
  ('pagi',  '07:00', '15:00'),
  ('sore',  '15:00', '23:00'),
  ('malam', '23:00', '07:00')
on conflict (nama) do nothing;

-- ─── PIKET ───────────────────────────────────────────────────

create table if not exists piket (
  id              uuid primary key default uuid_generate_v4(),
  ulp_id          uuid not null references ulp(id) on delete cascade,
  shift_type_id   uuid not null references shift_type(id),
  tanggal         date not null,
  created_at      timestamptz not null default now(),
  unique(ulp_id, shift_type_id, tanggal)
);

-- ─── LAPORAN ─────────────────────────────────────────────────

create table if not exists laporan (
  id              uuid primary key default uuid_generate_v4(),
  nomor_tiket     text not null,
  ulp_id          uuid not null references ulp(id) on delete cascade,
  piket_id        uuid references piket(id) on delete set null,
  regu_id         uuid not null references regu(id) on delete restrict,
  nama_pelanggan  text not null,
  nomor_pelanggan text,
  lokasi          text not null,
  status          status_laporan not null default 'lapor',
  keterangan      text,
  magic_token     text not null unique default encode(gen_random_bytes(24), 'hex'),
  wa_message_id   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  unique(ulp_id, nomor_tiket)
);

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists laporan_updated_at on laporan;
create trigger laporan_updated_at
  before update on laporan
  for each row execute function set_updated_at();

-- ─── RIWAYAT STATUS ──────────────────────────────────────────

create table if not exists riwayat_status (
  id          uuid primary key default uuid_generate_v4(),
  laporan_id  uuid not null references laporan(id) on delete cascade,
  status_lama status_laporan not null,
  status_baru status_laporan not null,
  keterangan  text,
  updated_by  updated_by_type not null default 'cc',
  created_at  timestamptz not null default now()
);

-- ─── WA SESSION ──────────────────────────────────────────────

create table if not exists wa_session (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade unique,
  status       wa_status not null default 'disconnected',
  session_data jsonb,
  updated_at   timestamptz not null default now()
);

-- ─── PROFILES ────────────────────────────────────────────────

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nama        text not null,
  role        user_role not null default 'cc',
  created_at  timestamptz not null default now()
  -- up3_id ditambahkan migration_up3.sql, uiw_id oleh peran_2_struktur.sql.
  -- ulp_id sudah DIHAPUS — cakupan ULP kini lewat tabel user_ulp di bawah.
);

-- Cakupan ULP per pengguna. Tabel ini sebelumnya hanya ada di database dan
-- tidak pernah tercatat di repo, padahal seluruh otorisasi multi-ULP
-- bersandar padanya.
create table if not exists user_ulp (
  id       uuid primary key default uuid_generate_v4(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  ulp_id   uuid not null references ulp(id) on delete cascade,
  unique(user_id, ulp_id)
);
create index if not exists idx_user_ulp_user on user_ulp(user_id);
create index if not exists idx_user_ulp_ulp  on user_ulp(ulp_id);

alter table user_ulp enable row level security;
drop policy if exists "user_ulp_select" on user_ulp;
create policy "user_ulp_select" on user_ulp
  for select using (user_id = auth.uid());

-- ─── INDEXES ─────────────────────────────────────────────────

create index if not exists idx_laporan_ulp_id      on laporan(ulp_id);
create index if not exists idx_laporan_regu_id     on laporan(regu_id);
create index if not exists idx_laporan_piket_id    on laporan(piket_id);
create index if not exists idx_laporan_status      on laporan(status);
create index if not exists idx_laporan_magic_token on laporan(magic_token);
create index if not exists idx_laporan_created_at  on laporan(created_at desc);
create index if not exists idx_riwayat_laporan_id  on riwayat_status(laporan_id);
create index if not exists idx_regu_ulp_id         on regu(ulp_id);
create index if not exists idx_petugas_regu_id     on petugas_apkt(regu_id);
create index if not exists idx_piket_ulp_tanggal   on piket(ulp_id, tanggal desc);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────

alter table ulp            enable row level security;
alter table regu           enable row level security;
alter table petugas_apkt   enable row level security;
alter table piket          enable row level security;
alter table laporan        enable row level security;
alter table riwayat_status enable row level security;
alter table wa_session     enable row level security;
alter table profiles       enable row level security;

-- Helper functions
create or replace function get_my_ulp_id()
returns uuid language sql security definer stable as $$
  select ulp_id from profiles where id = auth.uid()
$$;

create or replace function get_my_role()
returns user_role language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

-- ─── POLICIES (drop & recreate agar idempotent) ──────────────

drop policy if exists "ulp_select"       on ulp;
drop policy if exists "regu_select"      on regu;
drop policy if exists "regu_manage"      on regu;
drop policy if exists "petugas_select"   on petugas_apkt;
drop policy if exists "petugas_manage"   on petugas_apkt;
drop policy if exists "piket_select"     on piket;
drop policy if exists "piket_manage"     on piket;
drop policy if exists "laporan_select"   on laporan;
drop policy if exists "laporan_insert"   on laporan;
drop policy if exists "laporan_update"   on laporan;
drop policy if exists "riwayat_select"   on riwayat_status;
drop policy if exists "riwayat_insert"   on riwayat_status;
drop policy if exists "wa_session_select" on wa_session;
drop policy if exists "wa_session_manage" on wa_session;
drop policy if exists "profiles_select"  on profiles;
drop policy if exists "profiles_update"  on profiles;
drop policy if exists "shift_type_select" on shift_type;

create policy "ulp_select" on ulp for select
  using (id = get_my_ulp_id() or get_my_role() = 'admin');

create policy "regu_select" on regu for select
  using (ulp_id = get_my_ulp_id() or get_my_role() = 'admin');

create policy "regu_manage" on regu for all
  using (get_my_role() = 'admin');

create policy "petugas_select" on petugas_apkt for select
  using (ulp_id = get_my_ulp_id() or get_my_role() = 'admin');

create policy "petugas_manage" on petugas_apkt for all
  using (get_my_role() = 'admin');

create policy "piket_select" on piket for select
  using (ulp_id = get_my_ulp_id() or get_my_role() = 'admin');

create policy "piket_manage" on piket for all
  using (ulp_id = get_my_ulp_id() and get_my_role() in ('admin', 'supervisor', 'cc'));

create policy "laporan_select" on laporan for select
  using (ulp_id = get_my_ulp_id() or get_my_role() = 'admin');

create policy "laporan_insert" on laporan for insert
  with check (ulp_id = get_my_ulp_id() and get_my_role() in ('admin', 'cc'));

create policy "laporan_update" on laporan for update
  using (ulp_id = get_my_ulp_id() and get_my_role() in ('admin', 'supervisor', 'cc'));

create policy "riwayat_select" on riwayat_status for select
  using (
    exists (
      select 1 from laporan l
      where l.id = laporan_id
        and (l.ulp_id = get_my_ulp_id() or get_my_role() = 'admin')
    )
  );

create policy "riwayat_insert" on riwayat_status for insert
  with check (
    exists (
      select 1 from laporan l
      where l.id = laporan_id and l.ulp_id = get_my_ulp_id()
    )
  );

create policy "wa_session_select" on wa_session for select
  using (user_id = auth.uid() or get_my_role() = 'admin');

create policy "wa_session_manage" on wa_session for all
  using (user_id = auth.uid() and get_my_role() in ('admin', 'supervisor'));

create policy "profiles_select" on profiles for select
  using (id = auth.uid() or get_my_role() = 'admin' or ulp_id = get_my_ulp_id());

create policy "profiles_update" on profiles for update
  using (id = auth.uid() or get_my_role() = 'admin');

alter table shift_type enable row level security;
create policy "shift_type_select" on shift_type for select using (true);

-- ─── REALTIME ────────────────────────────────────────────────

alter publication supabase_realtime add table laporan;
alter publication supabase_realtime add table riwayat_status;
alter publication supabase_realtime add table wa_session;

-- REPLICA IDENTITY FULL wajib untuk filtered subscriptions (ulp_id=eq.xxx)
alter table laporan        replica identity full;
alter table riwayat_status replica identity full;
alter table wa_session     replica identity full;
