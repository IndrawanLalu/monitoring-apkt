-- ============================================================
-- FIX: RLS Multi-ULP Support (v2 - menggunakan array bukan setof)
-- ============================================================

-- 1. Buat fungsi yang mengembalikan ARRAY uuid[] (bukan setof)
create or replace function get_my_ulp_ids()
returns uuid[] language sql security definer stable as $$
  select array(select ulp_id from user_ulp where user_id = auth.uid())
$$;

-- 2. Hapus semua policy lama
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
drop policy if exists "riwayat_select"    on riwayat_status;
drop policy if exists "riwayat_insert"    on riwayat_status;
drop policy if exists "wa_session_select" on wa_session;
drop policy if exists "wa_session_manage" on wa_session;
drop policy if exists "profiles_select"   on profiles;
drop policy if exists "profiles_update"   on profiles;

-- 3. Buat ulang semua policy dengan get_my_ulp_ids() array

create policy "ulp_select" on ulp
  for select using (id = any(get_my_ulp_ids()) or get_my_role() = 'admin');

create policy "regu_select" on regu
  for select using (ulp_id = any(get_my_ulp_ids()) or get_my_role() = 'admin');

create policy "regu_manage" on regu
  for all using (ulp_id = any(get_my_ulp_ids()) and get_my_role() in ('admin', 'supervisor', 'cc'));

create policy "petugas_select" on petugas_apkt
  for select using (ulp_id = any(get_my_ulp_ids()) or get_my_role() = 'admin');

create policy "petugas_manage" on petugas_apkt
  for all using (ulp_id = any(get_my_ulp_ids()) and get_my_role() in ('admin', 'supervisor', 'cc'));

create policy "piket_select" on piket
  for select using (ulp_id = any(get_my_ulp_ids()) or get_my_role() = 'admin');

create policy "piket_manage" on piket
  for all using (ulp_id = any(get_my_ulp_ids()) and get_my_role() in ('admin', 'supervisor', 'cc'));

create policy "laporan_select" on laporan
  for select using (ulp_id = any(get_my_ulp_ids()) or get_my_role() = 'admin');

create policy "laporan_insert" on laporan
  for insert with check (ulp_id = any(get_my_ulp_ids()) and get_my_role() in ('admin', 'cc'));

create policy "laporan_update" on laporan
  for update using (ulp_id = any(get_my_ulp_ids()) and get_my_role() in ('admin', 'supervisor', 'cc'));

create policy "riwayat_select" on riwayat_status
  for select using (
    exists (
      select 1 from laporan l
      where l.id = laporan_id
        and (l.ulp_id = any(get_my_ulp_ids()) or get_my_role() = 'admin')
    )
  );

create policy "riwayat_insert" on riwayat_status
  for insert with check (
    exists (
      select 1 from laporan l
      where l.id = laporan_id and l.ulp_id = any(get_my_ulp_ids())
    )
  );

create policy "wa_session_select" on wa_session
  for select using (user_id = auth.uid() or get_my_role() = 'admin');

create policy "wa_session_manage" on wa_session
  for all using (user_id = auth.uid() and get_my_role() in ('admin', 'supervisor'));

create policy "profiles_select" on profiles
  for select using (id = auth.uid() or get_my_role() = 'admin');

create policy "profiles_update" on profiles
  for update using (id = auth.uid() or get_my_role() = 'admin');
