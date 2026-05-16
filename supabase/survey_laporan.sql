-- ============================================================
-- Tabel survey kepuasan pelanggan
-- Jalankan di SQL Editor Supabase
-- ============================================================

create table if not exists survey_laporan (
  id                    uuid primary key default uuid_generate_v4(),
  laporan_id            uuid not null references laporan(id) on delete cascade unique,
  nomor_tiket           text not null,
  nama_pelanggan        text not null,
  alamat                text not null,
  kondisi_setelah       text not null, -- 'tidak_ada' | 'kadang_padam' | 'padam_sekarang'
  kualitas_pelayanan    text not null, -- 'sangat_buruk' | 'buruk' | 'cukup' | 'baik' | 'sangat_baik'
  kecepatan_respon      text not null,
  ada_pungli            text not null, -- 'ada' | 'tidak_ada'
  ada_tips              text not null,
  ada_3s                text not null,
  ada_identitas         text not null,
  ada_apd               text not null,
  ada_hal_tidak_senang  text not null,
  kepuasan_keseluruhan  text not null, -- 'sangat_puas' | 'puas' | 'biasa' | 'tidak_puas' | 'sangat_tidak_puas'
  pesan_saran           text,
  submitted_at          timestamptz not null default now()
);

-- RLS: hanya admin yang bisa baca, insert boleh tanpa auth (public via admin client)
alter table survey_laporan enable row level security;

drop policy if exists "survey_select" on survey_laporan;
drop policy if exists "survey_insert" on survey_laporan;

-- Admin bisa baca semua survey
create policy "survey_select" on survey_laporan
  for select using (get_my_role() = 'admin');

-- Insert tidak perlu auth (dilakukan via admin client di API route)
-- Tidak ada policy insert → hanya service_role (admin client) yang bisa insert

-- Index untuk lookup cepat
create index if not exists idx_survey_laporan_id on survey_laporan(laporan_id);
create index if not exists idx_survey_nomor_tiket on survey_laporan(nomor_tiket);
