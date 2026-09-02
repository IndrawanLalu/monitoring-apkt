#!/bin/bash
# ============================================================
# Menutup akses aplikasi lewat IP mentah dan nip.io.
#
# Setelah app.commandcenter.my.id aktif dengan TLS, akses lama lewat
# http://103.59.95.107 dan http://103.59.95.107.nip.io tidak lagi diperlukan —
# dan justru berbahaya, karena melayani halaman login tanpa enkripsi.
#
# Skrip ini:
#   1. mencadangkan kondisi Nginx sekarang
#   2. mematikan server block monitoring-apkt (yang melayani IP & nip.io)
#   3. menghapus file `monitoring` yang server_name-nya duplikat dgn `commandcenter`
#   4. memasang blok default yang menolak hostname tak dikenal
#   5. MENGUJI konfigurasi — kalau gagal, semuanya dikembalikan otomatis
#   6. reload lalu memverifikasi ketiga aplikasi masih hidup
#
# Aman diulang. Jalankan: sudo ./ops/tutup-akses-ip.sh
# ============================================================
set -u

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✔ $1${NC}"; }
info() { echo -e "${CYAN}» $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✘ $1${NC}"; }

SA=/etc/nginx/sites-available
SE=/etc/nginx/sites-enabled
CADANGAN="/root/nginx-cadangan-$(date +%Y%m%d-%H%M%S)"

if [ "$(id -u)" -ne 0 ]; then
  fail "Jalankan dengan sudo: sudo ./ops/tutup-akses-ip.sh"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   TUTUP AKSES LEWAT IP & NIP.IO              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── 0. Syarat: subdomain baru harus sudah hidup ────────────
info "Memastikan app.commandcenter.my.id sudah melayani HTTPS..."
KODE=$(curl -s -o /dev/null -m 15 -w "%{http_code}" https://app.commandcenter.my.id/login || echo "000")
if [ "$KODE" != "200" ]; then
  fail "app.commandcenter.my.id menjawab HTTP $KODE, bukan 200."
  fail "Jangan tutup akses lama sebelum yang baru terbukti jalan — Anda bisa terkunci."
  exit 1
fi
ok "Subdomain baru sehat (HTTP 200)"

# ─── 1. Cadangkan ───────────────────────────────────────────
mkdir -p "$CADANGAN"
cp -rL "$SE" "$CADANGAN/sites-enabled" 2>/dev/null || true
ls "$SE" > "$CADANGAN/daftar-aktif.txt"
[ -f "$SA/monitoring" ] && cp "$SA/monitoring" "$CADANGAN/monitoring" 2>/dev/null
ok "Cadangan disimpan di $CADANGAN"

# ─── 2. Matikan blok nip.io / IP ────────────────────────────
if [ -L "$SE/monitoring-apkt" ] || [ -f "$SE/monitoring-apkt" ]; then
  rm -f "$SE/monitoring-apkt"
  ok "Server block monitoring-apkt (IP & nip.io) dinonaktifkan"
else
  warn "monitoring-apkt sudah tidak aktif — dilewati"
fi

# ─── 3. Buang file duplikat mati ────────────────────────────
# `monitoring` memakai server_name yang sama persis dengan `commandcenter`.
# Tidak aktif, tapi jebakan kalau suatu saat terlanjur di-symlink.
if [ -f "$SA/monitoring" ]; then
  rm -f "$SA/monitoring"
  ok "File duplikat sites-available/monitoring dihapus"
fi

# ─── 4. Blok penolak hostname tak dikenal ───────────────────
# Tanpa ini, permintaan ke IP jatuh ke server block pertama menurut abjad —
# aplikasi tetap terlayani lewat HTTP polos, jadi langkah 2 sia-sia.
cat > "$SA/tolak-default" <<'NGINX'
# Menolak permintaan dengan hostname tak dikenal: IP mentah, nip.io lama,
# atau pemindai otomatis. Setiap aplikasi punya server_name eksplisit
# sendiri, jadi tidak ada yang bergantung pada blok default ini.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
}
NGINX
ln -sf "$SA/tolak-default" "$SE/tolak-default"
ok "Blok penolak dipasang"

# ─── 5. Uji — kembalikan otomatis kalau gagal ───────────────
info "Menguji konfigurasi Nginx..."
if ! nginx -t 2>/tmp/nginx-uji.log; then
  echo ""
  fail "Konfigurasi TIDAK lolos uji. Mengembalikan seperti semula..."
  cat /tmp/nginx-uji.log
  rm -f "$SE/tolak-default" "$SA/tolak-default"
  [ -f "$SA/monitoring-apkt" ] && ln -sf "$SA/monitoring-apkt" "$SE/monitoring-apkt"
  [ -f "$CADANGAN/monitoring" ] && cp "$CADANGAN/monitoring" "$SA/monitoring"
  nginx -t >/dev/null 2>&1 && systemctl reload nginx
  fail "Sudah dikembalikan. Nginx tetap berjalan seperti sebelumnya."
  exit 1
fi
ok "Konfigurasi lolos uji"

systemctl reload nginx
ok "Nginx di-reload"

# ─── 6. Verifikasi ──────────────────────────────────────────
echo ""
info "Memverifikasi..."
echo ""

cek() { # nama, url, harapan, [flag curl tambahan]
  local kode
  kode=$(curl -s ${4:-} -o /dev/null -m 15 -w "%{http_code}" "$2" 2>/dev/null || echo "000")
  if [ "$kode" = "$3" ]; then
    printf "  ${GREEN}✔${NC} %-24s %s\n" "$1" "$kode"
  else
    printf "  ${YELLOW}?${NC} %-24s %s (diharapkan %s)\n" "$1" "$kode" "$3"
  fi
}

cek "app (internal)"      "https://app.commandcenter.my.id/login"        "200"
cek "antrian (publik)"    "https://commandcenter.my.id/antrian/tes"      "200"
cek "gateway WA"          "https://gateway.commandcenter.my.id/sessions" "401"
cek "IP http  (ditutup)"  "http://103.59.95.107/"                        "000"
cek "IP https (ditutup)"  "https://103.59.95.107/"                       "000" "-k"
cek "nip.io   (ditutup)"  "http://103.59.95.107.nip.io/"                 "000"

echo ""
printf "  smart-mataram            "
curl -s -o /dev/null -m 15 -w "%{http_code}  (200 atau 307 = hidup)\n" https://smart-mataram.my.id/ 2>/dev/null || echo "000"

echo ""
echo "Kalau ada yang meleset, kembalikan dengan:"
echo "  sudo rm -f $SE/tolak-default"
echo "  sudo ln -sf $SA/monitoring-apkt $SE/monitoring-apkt"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo ""
ok "Selesai. Cadangan ada di $CADANGAN"
echo ""
