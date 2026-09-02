-- ============================================================
-- PERAN — LANGKAH 1 dari 2: tambahkan nilai enum baru
--
-- WAJIB dijalankan SENDIRI, terpisah dari peran_2_struktur.sql.
-- PostgreSQL tidak mengizinkan nilai enum yang baru ditambahkan dipakai
-- di dalam transaksi yang sama. Menggabungkan keduanya akan gagal dengan
-- "unsafe use of new value of enum type".
--
-- Setelah menjalankan ini, JALANKAN peran_2_struktur.sql.
-- Aman diulang.
-- ============================================================

-- Nilai lama (admin, supervisor, cc) sengaja TIDAK dihapus.
-- PostgreSQL tidak bisa membuang nilai enum tanpa membuat ulang tipenya,
-- dan membiarkannya menganggur jauh lebih murah daripada risiko downtime.
-- Setelah migrasi, tidak ada satu baris pun yang memakainya.
alter type user_role add value if not exists 'super_admin';
alter type user_role add value if not exists 'uiw';
alter type user_role add value if not exists 'up3';
alter type user_role add value if not exists 'operator';

-- Verifikasi: harus memuat tujuh nilai.
select enumlabel as nilai_role
from pg_enum
where enumtypid = 'user_role'::regtype
order by enumsortorder;
