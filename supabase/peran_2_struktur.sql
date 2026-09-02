-- ============================================================
-- PERAN — LANGKAH 2 dari 2: struktur, migrasi data, dan RLS
--
-- Jalankan SETELAH peran_1_enum.sql. Aman diulang.
--
-- Hierarki yang dibangun, mencerminkan struktur PLN:
--   super_admin  → seluruh sistem; mengelola UIW, UP3, dan semua user
--   uiw          → semua UP3 di wilayahnya
--   up3          → semua ULP di UP3-nya          (dulu 'admin')
--   operator     → ULP yang di-assign padanya     (dulu 'cc')
--
-- Rantai datanya: uiw → up3 → ulp, dan user_ulp untuk operator.
-- ============================================================

-- ── 1. Tabel UIW ─────────────────────────────────────────────
create table if not exists uiw (
  id         uuid primary key default uuid_generate_v4(),
  nama       text not null,
  kode       text not null unique,
  created_at timestamptz not null default now()
);

alter table up3      add column if not exists uiw_id uuid references uiw(id) on delete restrict;
alter table profiles add column if not exists uiw_id uuid references uiw(id) on delete restrict;

create index if not exists idx_up3_uiw       on up3(uiw_id);
create index if not exists idx_profiles_up3  on profiles(up3_id);
create index if not exists idx_profiles_uiw  on profiles(uiw_id);

-- ── 2. Seed UIW & hubungkan UP3 yang ada ─────────────────────
-- UP3 Mataram dan UP3 Selaparang keduanya di bawah UIW Nusa Tenggara Barat.
insert into uiw (nama, kode) values ('UIW Nusa Tenggara Barat', 'NTB')
on conflict (kode) do nothing;

update up3
set uiw_id = (select id from uiw where kode = 'NTB')
where uiw_id is null;

-- ── 3. Migrasi peran ─────────────────────────────────────────
-- cc → operator, admin → up3. Dilakukan sebagai satu perintah agar tidak
-- ada saat di mana sebagian akun sudah berpindah dan sebagian belum.
update profiles set role = 'operator' where role = 'cc';
update profiles set role = 'up3'      where role = 'admin';

-- Akun ber-role 'up3' wajib punya up3_id, kalau tidak cakupannya kosong
-- dan mereka tidak melihat apa pun.
update profiles p
set up3_id = (
  select u.up3_id from user_ulp uu
  join ulp u on u.id = uu.ulp_id
  where uu.user_id = p.id and u.up3_id is not null
  limit 1
)
where p.role = 'up3' and p.up3_id is null;

-- ── 4. BOOTSTRAP super_admin ─────────────────────────────────
-- Dipindahkan ke peran_3_bootstrap.sql, karena akun yang dipilih ternyata
-- belum punya baris profiles sama sekali — jadi butuh INSERT, bukan UPDATE.
-- Jalankan berkas itu setelah yang ini.

-- ── 5. Fungsi cakupan ────────────────────────────────────────
-- get_my_ulp_id() versi lama membaca profiles.ulp_id — kolom yang SUDAH
-- TIDAK ADA di database ini. Fungsinya dibuang agar tidak jadi ranjau.
drop function if exists get_my_ulp_id();

create or replace function get_my_role()
returns user_role language sql security definer stable
set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- Semua ULP yang boleh DILIHAT akun yang sedang login, menurut perannya.
-- Menggantikan get_my_ulp_ids() yang hanya mengenal user_ulp.
create or replace function get_my_ulp_ids()
returns uuid[] language sql security definer stable
set search_path = public as $$
  select case (select role from profiles where id = auth.uid())
    when 'super_admin' then
      (select coalesce(array_agg(id), '{}') from ulp)
    when 'uiw' then
      (select coalesce(array_agg(u.id), '{}') from ulp u
       join up3 p on p.id = u.up3_id
       where p.uiw_id = (select uiw_id from profiles where id = auth.uid()))
    when 'up3' then
      (select coalesce(array_agg(id), '{}') from ulp
       where up3_id = (select up3_id from profiles where id = auth.uid()))
    else
      (select coalesce(array_agg(ulp_id), '{}') from user_ulp where user_id = auth.uid())
  end
$$;

-- Peran yang boleh mengubah data operasional (regu, petugas, piket, laporan).
create or replace function boleh_kelola()
returns boolean language sql security definer stable
set search_path = public as $$
  select (select role from profiles where id = auth.uid())
         in ('super_admin', 'uiw', 'up3', 'operator', 'admin', 'cc', 'supervisor')
$$;

-- ── 6. RLS mengikuti peran baru ──────────────────────────────
-- Nilai lama masih ikut disebut agar tidak ada jendela waktu di mana akun
-- yang belum termigrasi kehilangan akses.
create or replace function saya_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select (select role from profiles where id = auth.uid())
         in ('super_admin', 'uiw', 'up3', 'admin')
$$;

drop policy if exists "ulp_select"        on ulp;
drop policy if exists "regu_select"       on regu;
drop policy if exists "regu_manage"       on regu;
drop policy if exists "petugas_select"    on petugas_apkt;
drop policy if exists "petugas_manage"    on petugas_apkt;
drop policy if exists "piket_select"      on piket;
drop policy if exists "piket_manage"      on piket;
drop policy if exists "laporan_select"    on laporan;
drop policy if exists "laporan_insert"    on laporan;
drop policy if exists "laporan_update"    on laporan;
drop policy if exists "profiles_select"   on profiles;
drop policy if exists "profiles_update"   on profiles;

create policy "ulp_select" on ulp
  for select using (id = any(get_my_ulp_ids()));

create policy "regu_select" on regu
  for select using (ulp_id = any(get_my_ulp_ids()));
create policy "regu_manage" on regu
  for all using (ulp_id = any(get_my_ulp_ids()) and boleh_kelola());

create policy "petugas_select" on petugas_apkt
  for select using (ulp_id = any(get_my_ulp_ids()));
create policy "petugas_manage" on petugas_apkt
  for all using (ulp_id = any(get_my_ulp_ids()) and boleh_kelola());

create policy "piket_select" on piket
  for select using (ulp_id = any(get_my_ulp_ids()));
create policy "piket_manage" on piket
  for all using (ulp_id = any(get_my_ulp_ids()) and boleh_kelola());

create policy "laporan_select" on laporan
  for select using (ulp_id = any(get_my_ulp_ids()));
create policy "laporan_insert" on laporan
  for insert with check (ulp_id = any(get_my_ulp_ids()) and boleh_kelola());
create policy "laporan_update" on laporan
  for update using (ulp_id = any(get_my_ulp_ids()) and boleh_kelola());

create policy "profiles_select" on profiles
  for select using (id = auth.uid() or saya_admin());
create policy "profiles_update" on profiles
  for update using (id = auth.uid() or saya_admin());

-- Tabel hierarki: boleh dibaca akun yang login, ditulis hanya lewat
-- service_role (admin client di server, yang sudah memeriksa wewenang).
alter table uiw enable row level security;
drop policy if exists "uiw_select" on uiw;
create policy "uiw_select" on uiw for select using (auth.uid() is not null);

alter table up3 enable row level security;
drop policy if exists "up3_select" on up3;
create policy "up3_select" on up3 for select using (auth.uid() is not null);

-- ── 7. Verifikasi ────────────────────────────────────────────
select 'peran' as bagian, role::text as nilai, count(*) as jumlah
from profiles group by role
union all
select 'up3 tanpa uiw', '-', count(*) from up3 where uiw_id is null
union all
select 'akun up3 tanpa up3_id', '-', count(*) from profiles where role = 'up3' and up3_id is null
union all
select 'akun uiw tanpa uiw_id', '-', count(*) from profiles where role = 'uiw' and uiw_id is null
order by bagian, nilai;
