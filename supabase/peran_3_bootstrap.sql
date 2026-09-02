-- ============================================================
-- PERAN — LANGKAH 3: perbaiki pembagian ULP dan buat super_admin pertama
--
-- Jalankan SETELAH peran_1_enum.sql dan peran_2_struktur.sql.
-- Aman diulang.
-- ============================================================

-- ── 1. Perbaiki pembagian ULP per UP3 ────────────────────────
-- migration_up3.sql dulu menyapu SEMUA ULP ke UP3 Mataram:
--     UPDATE ulp SET up3_id = (... 'MTR') WHERE up3_id IS NULL;
-- Saat itu memang baru ada satu UP3. UP3 Selaparang dibuat belakangan tapi
-- tidak ada ULP yang dipindahkan, sehingga tinggal kosong.
--
-- Selama belum ada pembatas berbasis UP3, salah peta ini tidak terasa. Begitu
-- peran 'up3' berlaku, Admin UP3 Mataram jadi melihat seluruh ULP Lombok
-- Tengah dan Timur yang bukan wewenangnya.
update ulp
set up3_id = (select id from up3 where kode = 'SEL')
where nama in ('ULP Praya', 'ULP Kopang', 'ULP Pringgabaya', 'ULP Selong');

-- ── 2. Super admin pertama ───────────────────────────────────
-- Akun ini punya sesi di Supabase Auth tapi TIDAK punya baris profiles —
-- salah satu dari 30 akun yatim di database ini. Sesi auth tanpa profil
-- itulah yang menyebabkan redirect loop dashboard↔login.
--
-- Karena itu barisnya dibuat dulu, baru perannya ditetapkan. Sekali ini saja
-- lewat SQL; setelahnya seluruh pengelolaan user bisa dari UI.
insert into profiles (id, nama, role)
select u.id, 'Indrawan Saputra', 'super_admin'
from auth.users u
where u.email = 'indrawan.saputra4@gmail.com'
on conflict (id) do update set role = 'super_admin';

-- Super admin tidak butuh baris user_ulp: cakupannya seluruh sistem,
-- diselesaikan get_my_ulp_ids() dan ulpIdsTerlihat() lewat perannya.

-- ── 3. Verifikasi ────────────────────────────────────────────
select 'ULP per UP3' as bagian, p.kode as nilai, count(u.id) as jumlah
from up3 p left join ulp u on u.up3_id = p.id
group by p.kode

union all
select 'akun per peran', role::text, count(*) from profiles group by role

union all
select 'super_admin siap', coalesce(
  (select 'ya' from profiles where role = 'super_admin' limit 1), 'BELUM'
), count(*) from profiles where role = 'super_admin'

order by bagian, nilai;
