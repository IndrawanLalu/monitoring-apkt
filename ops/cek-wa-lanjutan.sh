#!/usr/bin/env bash
# Lanjutan diagnostik WA — menambang PENYEBAB putus dari log sebelum log dihapus.
# HANYA MEMBACA. Jalankan sebelum `pm2 flush`.
#
#   bash ops/cek-wa-lanjutan.sh

set -uo pipefail
GW=/home/indrawansaputra/wa-api-gateway
LOGDIR=$HOME/.pm2/logs
OUT=$LOGDIR/wa-gateway-out.log
ERR=$LOGDIR/wa-gateway-error.log
garis() { printf '\n\033[1m═══ %s ═══\033[0m\n' "$1"; }

garis "Rentang waktu log (untuk menghitung laju, bukan total)"
for f in "$OUT" "$ERR"; do
  [ -f "$f" ] || continue
  echo "  $(basename "$f")  $(du -h "$f" | cut -f1)"
  echo "    awal : $(head -1 "$f" | cut -c1-120)"
  echo "    akhir: $(tail -1 "$f" | cut -c1-120)"
done
echo "  → 8783 reconnect dalam 3 bulan itu wajar; dalam 3 hari itu bencana"

garis "Logika sambung-ulang: fungsi _onConnectionUpdate"
awk '/_onConnectionUpdate/{f=1} f{print; n++} n>60{exit}' "$GW/src/sessionManager.js" | sed 's/^/  /'

garis "Adakah jeda bertingkat / batas percobaan?"
grep -nE "setTimeout|delay|backoff|attempt|maxRetr|Math.min|1000 \*" "$GW/src/sessionManager.js" | head -20 | sed 's/^/  /'

garis "Opsi makeWASocket (keepAlive, browser, versi)"
grep -n -A20 "makeWASocket" "$GW/src/sessionManager.js" | head -30 | sed 's/^/  /'

garis "20 baris ERROR paling sering (angka & id disamarkan)"
[ -f "$ERR" ] && tail -200000 "$ERR" \
  | sed -E 's/[0-9a-f]{8}-[0-9a-f-]{27}/<id>/g; s/[0-9]{5,}/<n>/g; s/"time":[0-9]+//g' \
  | cut -c1-160 | sort | uniq -c | sort -rn | head -20 | sed 's/^/  /'

garis "Sebaran 'logged out' menurut hari"
[ -f "$OUT" ] && grep -i "logged out" "$OUT" | grep -oE '"?time"?:?"?[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{4}-[0-9]{2}-[0-9]{2}' \
  | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | sort | uniq -c | sed 's/^/  /'
echo "  (kosong = log tidak memuat tanggal yang mudah dibaca)"

garis "Sesi yang tersimpan di auth/"
ls -la "$GW/auth" 2>/dev/null | sed 's/^/  /'
for d in "$GW"/auth/*/; do
  [ -d "$d" ] || continue
  echo "  $(basename "$d")  $(du -sh "$d" | cut -f1)  berkas:$(find "$d" -type f | wc -l)  terakhir-diubah:$(date -r "$d" '+%Y-%m-%d %H:%M')"
done
echo "  → sesi yang 'terakhir diubah' lama sekali = sesi mati yang tidak pernah dibersihkan"

garis "Apa yang memakan disk"
du -xh --max-depth=1 / 2>/dev/null | sort -rh | head -8 | sed 's/^/  /'
du -xh --max-depth=1 "$HOME" 2>/dev/null | sort -rh | head -8 | sed 's/^/  /'

printf '\n\033[1mSelesai. Kirim keluarannya SEBELUM menjalankan pm2 flush.\033[0m\n'
