-- ============================================================
-- FUNGSI AGREGASI DASHBOARD OUTAGE
-- Jalankan di SQL Editor Supabase. Aman diulang (create or replace).
--
-- Sebelumnya halaman /outage menarik SELURUH laporan selesai satu bulan ke
-- memori Node lalu diagregasi di JavaScript. Pada 1000 laporan/hari itu
-- ~30.000 baris per pembukaan halaman. Fungsi ini memindahkan hitungannya ke
-- Postgres — halaman hanya menerima hasil, bukan bahan mentah.
-- ============================================================

create or replace function rekap_outage(
  p_ulp_ids uuid[],
  p_mulai   timestamptz,
  p_selesai timestamptz
)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
with
-- Laporan yang DISELESAIKAN dalam periode, beserta durasi penanganannya.
selesai as (
  select
    l.id, l.ulp_id, l.nomor_tiket, l.lokasi, l.created_at, l.resolved_at,
    l.resolved_petugas_names,
    extract(epoch from (l.resolved_at - l.created_at)) / 60.0 as menit
  from laporan l
  where l.ulp_id = any(p_ulp_ids)
    and l.status = 'selesai'
    and l.resolved_at >= p_mulai
    and l.resolved_at <= p_selesai
),
-- Laporan yang MASUK dalam periode (dasar tren harian & jam sibuk).
masuk as (
  select l.id, l.ulp_id, l.created_at
  from laporan l
  where l.ulp_id = any(p_ulp_ids)
    and l.created_at >= p_mulai
    and l.created_at <= p_selesai
),
-- Survey atas laporan yang DISELESAIKAN dalam periode.
-- Sengaja mengikuti resolved_at laporan, bukan submitted_at survey: seluruh
-- halaman ini mengukur kinerja per periode kerja, dan petugas_selesai juga
-- memakai resolved_at. Kalau rating disaring dengan submitted_at, dua angka di
-- tab yang sama akan dihitung atas himpunan laporan yang berbeda — pelanggan
-- bisa mengisi survey berminggu-minggu setelah gangguan selesai (pada data ini
-- jeda terlama 43 hari).
-- Catatan: /rekap-survey sengaja memakai submitted_at karena menjawab
-- pertanyaan lain — "berapa survey yang masuk bulan ini".
survey as (
  select s.*, l.ulp_id, l.resolved_petugas_names
  from survey_laporan s
  join laporan l on l.id = s.laporan_id
  where l.ulp_id = any(p_ulp_ids)
    and l.status = 'selesai'
    and l.resolved_at >= p_mulai
    and l.resolved_at <= p_selesai
),
-- Satu baris per (petugas, laporan) — resolved_petugas_names berisi array.
petugas_selesai as (
  select trim(nama) as nama, s.ulp_id, s.menit
  from selesai s, unnest(coalesce(s.resolved_petugas_names, array[]::text[])) as nama
  where trim(nama) <> ''
),
petugas_survey as (
  select trim(nama) as nama, v.ulp_id, v.kepuasan_keseluruhan
  from survey v, unnest(coalesce(v.resolved_petugas_names, array[]::text[])) as nama
  where trim(nama) <> ''
)
select jsonb_build_object(

  'kpi', jsonb_build_object(
    'totalSelesai',   (select count(*) from selesai),
    'totalMasuk',     (select count(*) from masuk),
    'menitRata',      (select round(avg(menit)) from selesai),
    'menitTengah',    (select round(percentile_cont(0.5) within group (order by menit)) from selesai),
    -- Kepatuhan waktu: berapa persen selesai di bawah 3 jam.
    'persenDibawah3Jam', (
      select case when count(*) = 0 then null
             else round(100.0 * count(*) filter (where menit < 180) / count(*)) end
      from selesai
    ),
    'totalSurvey',    (select count(*) from survey),
    -- Indeks kepuasan 0–100: sangat_puas=100, puas=75, biasa=50,
    -- tidak_puas=25, sangat_tidak_puas=0.
    'indeksKepuasan', (
      select round(avg(case kepuasan_keseluruhan
        when 'sangat_puas' then 100 when 'puas' then 75 when 'biasa' then 50
        when 'tidak_puas' then 25 when 'sangat_tidak_puas' then 0 end))
      from survey
    ),
    -- Diambil dari kondisi SEKARANG, bukan dari periode — ini yang sedang berjalan.
    'masihTerbuka', (
      select count(*) from laporan
      where ulp_id = any(p_ulp_ids) and status <> 'selesai'
    )
  ),

  -- Tren harian: masuk vs selesai per tanggal (WITA).
  'trenHarian', coalesce((
    select jsonb_agg(jsonb_build_object('tanggal', t, 'masuk', m, 'selesai', s) order by t)
    from (
      select tanggal as t, sum(m) as m, sum(s) as s
      from (
        select (created_at at time zone 'Asia/Makassar')::date as tanggal, 1 as m, 0 as s from masuk
        union all
        select (resolved_at at time zone 'Asia/Makassar')::date, 0, 1 from selesai
      ) x group by tanggal
    ) y
  ), '[]'::jsonb),

  -- Sebaran durasi penanganan.
  'sebaranDurasi', coalesce((
    select jsonb_agg(jsonb_build_object('label', label, 'jumlah', n) order by urut)
    from (
      select
        case when menit < 60 then '< 1 jam'
             when menit < 180 then '1–3 jam'
             when menit < 360 then '3–6 jam'
             else '> 6 jam' end as label,
        case when menit < 60 then 1 when menit < 180 then 2
             when menit < 360 then 3 else 4 end as urut,
        count(*) as n
      from selesai group by 1, 2
    ) z
  ), '[]'::jsonb),

  -- Perbandingan antar-ULP.
  'perUlp', coalesce((
    select jsonb_agg(jsonb_build_object(
      'ulpId', u.id, 'nama', u.nama,
      'selesai', coalesce(a.n, 0), 'menitRata', a.rata
    ) order by coalesce(a.n, 0) desc, u.nama)
    from ulp u
    left join (
      select ulp_id, count(*) as n, round(avg(menit)) as rata
      from selesai group by ulp_id
    ) a on a.ulp_id = u.id
    where u.id = any(p_ulp_ids)
  ), '[]'::jsonb),

  -- Peta panas jam sibuk: hari-dalam-minggu (0=Minggu) × jam, dari waktu masuk.
  'jamSibuk', coalesce((
    select jsonb_agg(jsonb_build_object('hari', hari, 'jam', jam, 'jumlah', n))
    from (
      select
        extract(dow from (created_at at time zone 'Asia/Makassar'))::int as hari,
        extract(hour from (created_at at time zone 'Asia/Makassar'))::int as jam,
        count(*) as n
      from masuk group by 1, 2
    ) h
  ), '[]'::jsonb),

  -- Kinerja petugas: jumlah gangguan diselesaikan.
  'petugasSelesai', coalesce((
    select jsonb_agg(jsonb_build_object(
      'nama', nama, 'ulpNama', ulp_nama, 'jumlah', n, 'menitRata', rata
    ) order by n desc, nama)
    from (
      select p.nama, u.nama as ulp_nama, count(*) as n, round(avg(p.menit)) as rata
      from petugas_selesai p join ulp u on u.id = p.ulp_id
      group by p.nama, u.nama
    ) q
  ), '[]'::jsonb),

  -- Rating kepuasan per petugas.
  'petugasPuas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'nama', nama, 'ulpNama', ulp_nama,
      'sangatPuas', sp, 'puas', p_, 'biasa', b, 'tidakPuas', tp, 'sangatTidakPuas', stp,
      'total', tot
    ) order by sp desc, tot desc, nama)
    from (
      select
        p.nama, u.nama as ulp_nama,
        count(*) filter (where kepuasan_keseluruhan = 'sangat_puas')       as sp,
        count(*) filter (where kepuasan_keseluruhan = 'puas')              as p_,
        count(*) filter (where kepuasan_keseluruhan = 'biasa')             as b,
        count(*) filter (where kepuasan_keseluruhan = 'tidak_puas')        as tp,
        count(*) filter (where kepuasan_keseluruhan = 'sangat_tidak_puas') as stp,
        count(*) as tot
      from petugas_survey p join ulp u on u.id = p.ulp_id
      group by p.nama, u.nama
    ) q
  ), '[]'::jsonb),

  -- Kalender: total selesai per tanggal + rincian per petugas.
  -- Dihitung dua tahap: total harian dari `selesai`, rincian petugas dari
  -- hasil unnest — digabung per tanggal. Menghitung keduanya sekaligus dalam
  -- satu agregat akan menggandakan total untuk laporan yang dikerjakan dua orang.
  'kalender', coalesce((
    select jsonb_agg(jsonb_build_object('tanggal', d.tgl, 'total', d.tot, 'petugas', coalesce(p.ptg, '[]'::jsonb)) order by d.tgl)
    from (
      select (resolved_at at time zone 'Asia/Makassar')::date as tgl, count(*) as tot
      from selesai group by 1
    ) d
    left join (
      select tgl, jsonb_agg(jsonb_build_object('nama', nama, 'jumlah', n) order by n desc) as ptg
      from (
        select
          (s.resolved_at at time zone 'Asia/Makassar')::date as tgl,
          trim(nama) as nama,
          count(*) as n
        from selesai s, unnest(coalesce(s.resolved_petugas_names, array[]::text[])) as nama
        where trim(nama) <> ''
        group by 1, 2
      ) pp group by tgl
    ) p on p.tgl = d.tgl
  ), '[]'::jsonb),

  -- Kepatuhan petugas di lapangan — data ini sudah lama terkumpul di
  -- survey_laporan tapi belum pernah ditampilkan di mana pun.
  'kepatuhan', (
    select jsonb_build_object(
      'totalSurvey', count(*),
      'persen3s',        case when count(*) = 0 then null else round(100.0 * count(*) filter (where ada_3s = 'ada') / count(*)) end,
      'persenIdentitas', case when count(*) = 0 then null else round(100.0 * count(*) filter (where ada_identitas = 'ada') / count(*)) end,
      'persenApd',       case when count(*) = 0 then null else round(100.0 * count(*) filter (where ada_apd = 'ada') / count(*)) end,
      'jumlahPungli',    count(*) filter (where ada_pungli = 'ada'),
      'jumlahTips',      count(*) filter (where ada_tips = 'ada'),
      'jumlahTidakSenang', count(*) filter (where ada_hal_tidak_senang = 'ada')
    ) from survey
  ),

  -- Daftar insiden untuk ditindaklanjuti (pungli / tips / hal tidak menyenangkan).
  'insiden', coalesce((
    select jsonb_agg(jsonb_build_object(
      'nomorTiket', v.nomor_tiket, 'namaPelanggan', v.nama_pelanggan,
      'alamat', v.alamat, 'submittedAt', v.submitted_at,
      'pungli', v.ada_pungli = 'ada', 'tips', v.ada_tips = 'ada',
      'tidakSenang', v.ada_hal_tidak_senang = 'ada',
      'pesanSaran', v.pesan_saran,
      'petugas', coalesce(v.resolved_petugas_names, array[]::text[])
    ) order by v.submitted_at desc)
    from survey v
    where v.ada_pungli = 'ada' or v.ada_tips = 'ada' or v.ada_hal_tidak_senang = 'ada'
  ), '[]'::jsonb)
);
$$;

-- ── Keamanan ─────────────────────────────────────────────────
-- SECURITY DEFINER menembus RLS, jadi fungsi ini TIDAK boleh bisa dipanggil
-- dengan anon key yang memang publik di bundle browser — kalau bisa, siapa pun
-- dapat membaca agregat ULP mana pun hanya dengan menebak uuid.
-- Hanya service_role (admin client di server, yang sudah memvalidasi hak akses)
-- yang boleh memanggil.
revoke all on function rekap_outage(uuid[], timestamptz, timestamptz) from public;
revoke all on function rekap_outage(uuid[], timestamptz, timestamptz) from anon;
revoke all on function rekap_outage(uuid[], timestamptz, timestamptz) from authenticated;
grant execute on function rekap_outage(uuid[], timestamptz, timestamptz) to service_role;

-- ── Verifikasi ───────────────────────────────────────────────
-- Ganti uuid di bawah dengan salah satu ULP Anda untuk mencoba:
-- select jsonb_pretty(rekap_outage(
--   array['4bb2d6e7-b35f-4783-a61b-1f504bcde421']::uuid[],
--   '2026-08-01T00:00:00+08'::timestamptz,
--   '2026-08-31T23:59:59+08'::timestamptz
-- ));
