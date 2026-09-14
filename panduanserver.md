# Panduan Server — MONITORING APKT

Server: **`servercc`** · `10.33.20.22` · Ubuntu 26.04 LTS · user `admin_up2d`
Sejak 13 Sep 2026 semua komponen berada di satu server ini. VPS lama (`103.59.95.107`) sudah mati permanen.

---

## Masuk ke server

```bash
ssh servercc
```

Lewat Cloudflare Tunnel (`ssh-cc.up2dntb.my.id`), jadi **jalan dari mana saja** — kantor, rumah, jaringan apa pun. Konfigurasinya di `C:\Users\PLN\.ssh\config`.

Jalur cadangan lewat LAN kantor (lebih cepat, tapi hanya dari Wi-Fi `192.168.110.x`):

```bash
ssh servercc-lan
```

> **Kalau SSH tiba-tiba timeout**, cek dulu alamat IP laptopmu. Jaringan kantor punya beberapa segmen dan hanya `192.168.110.x` yang punya rute ke `10.33.20.x`. Jalur Cloudflare tidak terpengaruh — kalau ragu, pakai `ssh servercc`.
>
> **Jangan menguji koneksi berulang-ulang dengan cepat.** Firewall kantor punya pembatas laju dan akan memblokir laptopmu sementara. Gejalanya menipu: koneksi pertama berhasil, sesudahnya mati semua.

---

## Membuka antarmuka

Sejak 14 Sep 2026 aplikasi sudah punya alamat sendiri — staf tidak perlu terowongan lagi:

| Alamat | Untuk |
|---|---|
| `https://app.commandcenter.my.id` | Staf — dashboard, piket, settings, rekap |
| `https://commandcenter.my.id/antrian/<token>` | Pelanggan — hanya lorong ini yang terbuka |

Terowongan SSH tetap dibutuhkan untuk **Supabase Studio** dan **admin wa-gateway**, yang sengaja tidak diekspos ke internet. **Biarkan jendela terminalnya terbuka** selama dipakai.

| Yang dibuka | Perintah | Lalu buka di browser |
|---|---|---|
| Aplikasi APKT | `ssh -L 3000:localhost:4000 -L 8000:localhost:8000 servercc` | `http://localhost:3000` |
| Supabase Studio | sama seperti di atas | `http://localhost:8000` |
| Admin wa-gateway | `ssh -L 3001:localhost:3001 servercc` | `http://localhost:3001` |

Aplikasi berjalan di port **4000** di server (diminta tim IT; 3000 sudah dipakai di lingkungan mereka), tapi diteruskan ke port **3000 di laptopmu** — supaya URL yang sudah dipanggang ke dalam bundel browser saat build tetap sahih tanpa perlu build ulang.

Dua port harus dibuka sekaligus karena browser memanggil Supabase langsung untuk realtime. Kalau hanya satu yang dibuka, halaman termuat tapi data tidak muncul.

### Mengambil password

```bash
# Supabase Studio (username: supabase)
ssh servercc "grep '^DASHBOARD_PASSWORD=' ~/supabase-apkt/.env | cut -d= -f2-"

# Admin wa-gateway (email: indrawan.saputra4@gmail.com)
ssh servercc "grep '^ADMIN_PASSWORD=' /var/www/wa-gateway/.env | cut -d= -f2-"

# Halaman rekap publik
ssh servercc "grep '^REKAP_PASSWORD=' /var/www/monitoring-apkt/.env | cut -d= -f2-"
```

### Ganti password akun aplikasi

```bash
ssh servercc
./ganti-password.sh        # menanyakan email lalu password baru
```

---

## Perintah harian

```bash
# Status semua komponen
ssh servercc "pm2 list"
ssh servercc "cd ~/supabase-apkt && sh run.sh status"

# Log
ssh servercc "pm2 logs monitoring-apkt --lines 50 --nostream"
ssh servercc "pm2 logs wa-gateway --lines 50 --nostream"
ssh servercc "cd ~/supabase-apkt && sh run.sh logs db"

# Restart
ssh servercc "pm2 restart monitoring-apkt --update-env"
ssh servercc "pm2 restart wa-gateway"
ssh servercc "cd ~/supabase-apkt && sh run.sh restart"

# Sumber daya
ssh servercc "free -h; df -h /"
```

### Deploy perubahan kode

```bash
ssh servercc
cd /var/www/monitoring-apkt
git pull
pnpm install          # hanya kalau dependensi berubah
pnpm build
pm2 restart monitoring-apkt --update-env
```

> Sesi WhatsApp **selamat** melewati restart aplikasi, karena sesinya hidup di wa-gateway, bukan di proses Next.js.
>
> Unduhan di server ini lambat (~0,5 MB/detik). `pnpm install` bisa lama — itu normal, bukan kerusakan. Batas waktu pnpm sudah dilonggarkan ke 30 menit per berkas.

---

## Masalah umum

### WhatsApp: status "Tidak Terhubung", tombol Hubungkan tidak menghasilkan apa pun

Sesi tersangkut di status `logged_out` — WhatsApp mencabut tautan dari sisi HP. Sejak perbaikan 13 Sep 2026, tombol **Hubungkan** sudah bisa menyembuhkan sendiri. Kalau masih diam:

```bash
ssh servercc
KEY=$(grep -m1 '^WA_GATEWAY_KEY=' /var/www/monitoring-apkt/.env | cut -d= -f2-)
SID=apkt-<user-id-nya>
curl -s -X DELETE -H "X-Api-Key: $KEY" "http://127.0.0.1:3001/sessions/$SID"
cd ~/supabase-apkt && docker compose exec -T db psql -U postgres -c "delete from wa_session where user_id='<user-id-nya>';"
```

Lalu tekan Hubungkan lagi. Cari `user-id` di Supabase Studio, tabel `profiles`.

> **Jangan membuka daftar grup WA tepat setelah pairing.** Menarik ratusan grup sekaligus pada perangkat yang baru tertaut diduga memicu WhatsApp mencabut tautan. Beri jeda beberapa menit.

### Laporan tersimpan tapi WhatsApp tidak terkirim

Cek tiga hal, urut:

1. **`user_ulp`** — aplikasi memilih sesi WA lewat tabel ini: *"siapa yang ditugaskan ke ULP ini, sesi WA orang itu yang dipakai"*. Kalau ULP itu tidak punya petugas dengan sesi WA aktif, pengiriman dibatalkan **diam-diam** (`wa_message_id` jadi `NULL`, layar tetap hijau). Ingat: `super_admin` sengaja tidak punya baris `user_ulp`, jadi sesi WA-nya tidak dipakai untuk ULP mana pun.
2. **`ulp.wa_grup_id`** — nomor WhatsApp yang tertaut harus **anggota grup itu**. Kalau bukan, WhatsApp menolak.
3. **Log** — `pm2 logs monitoring-apkt` lalu cari `[WA] gagal kirim`.

### Aplikasi tidak bisa dibuka

```bash
ssh servercc "pm2 list"                                   # online?
ssh servercc "curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/login"
ssh servercc "tail -30 ~/.pm2/logs/monitoring-apkt-error.log"
```

Kalau `pm2 list` kosong padahal server baru reboot, PM2 belum diaktifkan untuk startup:

```bash
ssh servercc "pm2 resurrect"
```

### Supabase tidak menjawab

```bash
ssh servercc "cd ~/supabase-apkt && sh run.sh status"     # ketujuh layanan running?
ssh servercc "cd ~/supabase-apkt && sh run.sh logs db"
ssh servercc "cd ~/supabase-apkt && sh run.sh restart"
```

> `HTTP 403` saat membuka `/rest/v1/` itu **normal** — PostgREST menolak menyajikan daftar skema kepada peran anon. Bukan kerusakan.

### Halaman /laporan hanya menampilkan satu ULP

Sudah diketahui, belum diperbaiki. Halaman itu terikat ke satu ULP aktif dan `super_admin` selalu mendapat ULP pertama secara abjad (ULP Alas), tanpa pemilih di UI. Akal-akalan sementara: set cookie `active_ulp_id` lewat DevTools → Application → Cookies.

---

## Apa berjalan di mana

| Komponen | Port | Terbuka ke | Dikelola |
|---|---|---|---|
| Aplikasi Next.js | **4000** | jaringan | PM2 `monitoring-apkt` |
| Supabase API (Envoy) | 8000 | jaringan | Docker `~/supabase-apkt` |
| Supabase Studio | lewat 8000 | jaringan | Docker |
| wa-gateway (Baileys) | 3001 | **localhost saja** | PM2 `wa-gateway` |
| PostgreSQL 17.6 | 5432 | **localhost saja** | Docker |
| SSH | 22 | jaringan | systemd |

Satu PostgreSQL dipakai bersama: tabel APKT di schema `public` (15 tabel), tabel gateway di schema `gateway` (3 tabel). Satu backup mencakup keduanya.

Lokasi:

```
/var/www/monitoring-apkt     aplikasi
/var/www/wa-gateway          gateway WhatsApp
~/supabase-apkt              Supabase (docker compose)
~/.pm2/logs/                 log PM2
```

---

## Domain dan tunnel

Dikerjakan sendiri, tanpa tim IT. `commandcenter.my.id` ada di akun Cloudflare milik sendiri; `up2dntb.my.id` tetap milik IT dan hanya melayani `ssh-cc`.

**Dua `cloudflared` berjalan berdampingan di servercc:**

| | Service | Folder | Metrics |
|---|---|---|---|
| Milik IT (SSH) | `cloudflared.service` | `/etc/cloudflared/` | `127.0.0.1:20241` |
| Milik kita (aplikasi) | `cloudflared-apkt.service` | `/etc/cloudflared-apkt/` | `127.0.0.1:20242` |

> ⚠️ **Jangan pernah menjalankan `cloudflared service install`** dari dashboard Cloudflare. Perintah itu memakai nama service dan folder yang **sama persis** dengan milik IT — akan menimpanya dan memutus akses SSH-mu sendiri. Instance kedua dipasang lewat `~/pasang-tunnel-apkt.sh` yang menulis unit systemd-nya sendiri.
>
> Port metrics **wajib berbeda**. Kalau sama, instance kedua gagal menyala dan pesan errornya tidak menyebut penyebabnya.

**Tiga hostname aktif:**

| Hostname | Ke | Untuk |
|---|---|---|
| `commandcenter.my.id` | `localhost:4000` | Pelanggan |
| `app.commandcenter.my.id` | `localhost:4000` | Staf |
| `api.commandcenter.my.id` | `localhost:8000` | Supabase |

Semuanya **Type: HTTP**, bukan HTTPS — layanan di server memang HTTP biasa, TLS diterminasi Cloudflare. Kalau dipilih HTTPS, hasilnya 502.

Tidak ada Cloudflare Access di ketiganya. Pembatasannya di dalam aplikasi (`proxy.ts`).

### Menambah hostname baru

Dashboard Cloudflare → **Networks → Tunnels → `servercc-apkt` → Public Hostname → Add**. Catatan DNS dibuat otomatis.

### Menguji pagar hostname

```bash
# Dari server, tanpa lewat internet:
curl -H "Host: commandcenter.my.id" -o /dev/null -w "%{http_code}
" http://localhost:4000/rekap-laporan   # harus 404
curl -H "Host: commandcenter.my.id" -o /dev/null -w "%{http_code}
" http://localhost:4000/antrian/x        # harus 200
```

> **Pagar itu memeriksa nama host secara persis.** Kalau domain publik suatu saat berganti, konstanta `HOSTNAME_PELANGGAN` di `proxy.ts` **wajib** ikut diganti — kalau terlewat, seluruh halaman staf terbuka ke publik tanpa peringatan apa pun.

### Mengubah alamat

Kalau domain berganti, empat baris di `/var/www/monitoring-apkt/.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://api.commandcenter.my.id
NEXT_PUBLIC_APP_URL=https://app.commandcenter.my.id
NEXT_PUBLIC_ANTRIAN_BASE_URL=https://commandcenter.my.id   # APEX — link ke pelanggan
APP_URL=https://app.commandcenter.my.id
```

dan tiga di `~/supabase-apkt/.env`:

```env
SUPABASE_PUBLIC_URL=https://api.commandcenter.my.id
API_EXTERNAL_URL=https://api.commandcenter.my.id/auth/v1
SITE_URL=https://app.commandcenter.my.id
```

Lalu:

```bash
cd /var/www/monitoring-apkt && pnpm build && pm2 restart monitoring-apkt --update-env
cd ~/supabase-apkt && sh run.sh restart
```

Build ulang **wajib** — `NEXT_PUBLIC_*` dipanggang ke bundel browser saat build. Periksa hasilnya:

```bash
grep -rl "localhost" .next/static | wc -l    # harus 0
```

## Yang belum beres

- **Keamanan SSH** — login password masih aktif, tunnel belum dipagari Cloudflare Access. Harus ditutup sebelum data pelanggan sungguhan masuk:
  ```bash
  printf "PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n" | sudo tee /etc/ssh/sshd_config.d/99-keamanan.conf
  sudo systemctl restart ssh
  ```
  Jangan tutup sesi yang sedang terbuka sampai sesi baru terbukti masuk. Console Proxmox tetap jadi jalan cadangan.

- **Backup belum ada.** Supabase Cloud dulu mengurusnya otomatis; di server sendiri itu jadi tanggung jawab kita. Perlu `pg_dump` harian plus salinan ke luar gedung. Snapshot Proxmox saja tidak cukup — snapshot bukan backup.

- **Tujuh ULP memegang `wa_grup_id` dari sistem lama** (Cakra, Gerung, Kopang, Praya, Pringgabaya, Selong, Tanjung) dan nomor sekarang bukan anggotanya. Perlu akun operator per ULP yang menautkan WhatsApp masing-masing.

- **ULP Alas memakai ID grup yang sama dengan Ampenan** — laporan Alas akan masuk ke grup Ampenan.

- **`/api/*` tidak ikut dipagari hostname** karena dikecualikan di `matcher`. Endpoint-nya terjangkau dari domain publik, tapi tiap route memeriksa auth sendiri dan menjawab 401/403. Risiko rendah.

- **Data uji masih ada** — beberapa laporan dan piket percobaan. Bersihkan sebelum dipakai sungguhan.

- **Tujuh ULP belum punya operator dengan WhatsApp tertaut**, jadi notifikasi untuk ULP itu belum jalan.
