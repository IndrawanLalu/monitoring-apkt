#!/usr/bin/env bash
# Diagnostik kestabilan koneksi WhatsApp di VPS. HANYA MEMBACA — tidak
# mengubah, merestart, atau memutus apa pun. Aman dijalankan kapan saja,
# termasuk saat production sedang dipakai.
#
#   bash ops/cek-stabilitas-wa.sh
#
# Tujuannya menjawab tiga hal yang tidak bisa dilihat dari luar VPS:
#   1. Seberapa sering sesi WA benar-benar putus selama ini
#   2. Apakah gateway menyambung ulang sendiri, dan berapa lama
#   3. Apakah RAM cukup untuk 10-20 sesi sekaligus

set -uo pipefail
garis() { printf '\n\033[1m═══ %s ═══\033[0m\n' "$1"; }

garis "Proses PM2"
pm2 jlist 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 let a;try{a=JSON.parse(s)}catch(e){return console.log("  pm2 jlist tidak terbaca")}
 for(const p of a){const e=p.pm2_env||{},m=p.monit||{};
  console.log("  "+String(p.name).padEnd(18)+String(e.status).padEnd(9)+
   "restart:"+String(e.restart_time).padEnd(6)+
   "RAM:"+String((m.memory/1048576).toFixed(0)+"MB").padEnd(8)+
   "uptime:"+((Date.now()-e.pm_uptime)/3600000).toFixed(1)+"j");
  console.log("    cwd: "+(e.pm_cwd||"?"));}})'
echo "  → restart tinggi = proses sering mati; tiap mati menjatuhkan SEMUA sesi WA"

garis "RAM & swap"
free -m | sed 's/^/  /'
echo "  → 20 sesi Baileys butuh ruang; kalau 'available' sudah tipis sekarang, belum cukup"

garis "Direktori gateway"
GW=$(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s).find(p=>/gateway/i.test(p.name));console.log(a?a.pm2_env.pm_cwd:"")}catch(e){console.log("")}})')
if [ -z "$GW" ] || [ ! -d "$GW" ]; then
  echo "  tidak ketemu otomatis — isi manual: GW=/path/ke/wa-gateway"
else
  echo "  $GW"
  garis "Versi Baileys"
  node -e "
    const p=require('$GW/package.json');
    const d={...(p.dependencies||{}),...(p.devDependencies||{})};
    for(const k in d) if(/baileys|whiskey/i.test(k)) console.log('  '+k+' '+d[k]);
  " 2>/dev/null || echo "  package.json tidak terbaca"
  node -e "
    try{const p=require('$GW/node_modules/@whiskeysockets/baileys/package.json');console.log('  terpasang:',p.version)}
    catch(e){try{const p=require('$GW/node_modules/baileys/package.json');console.log('  terpasang:',p.version)}catch(e2){}}
  " 2>/dev/null

  garis "Logika sambung-ulang di kode gateway"
  SRC=$(find "$GW" -maxdepth 3 \( -name '*.js' -o -name '*.ts' -o -name '*.mjs' \) ! -path '*/node_modules/*' 2>/dev/null)
  if [ -n "$SRC" ]; then
    for pola in "DisconnectReason" "loggedOut" "restartRequired" "connectionClosed" "reconnect" "keepAlive" "retry" "useMultiFileAuthState" "saveCreds"; do
      n=$(echo "$SRC" | xargs grep -c "$pola" 2>/dev/null | awk -F: '{s+=$NF}END{print s+0}')
      printf "  %-24s %s\n" "$pola" "$n"
    done
    echo
    echo "  ── penanganan connection.update ──"
    echo "$SRC" | xargs grep -n -A12 "connection.update" 2>/dev/null | head -40 | sed 's/^/  /'
  else
    echo "  sumber tidak ketemu (mungkin sudah di-bundle/dist)"
  fi

  garis "Penyimpanan kredensial sesi"
  for d in "$GW/sessions" "$GW/auth" "$GW/store" "$GW/data" "$GW/.sessions"; do
    [ -d "$d" ] && echo "  $d  —  $(du -sh "$d" 2>/dev/null | cut -f1), $(find "$d" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l) sesi"
  done
  echo "  → kalau folder ini hilang/terhapus, semua sesi WAJIB scan QR ulang"
fi

garis "Riwayat putus-sambung dari log PM2"
LOG=$(pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s).find(p=>/gateway/i.test(p.name));console.log(a?a.pm2_env.pm_out_log_path:"")}catch(e){console.log("")}})')
LOGE=${LOG%out.log}error.log
for f in "$LOG" "$LOGE"; do
  [ -f "$f" ] || continue
  echo "  $f  ($(du -sh "$f" 2>/dev/null | cut -f1))"
  for pola in "connection closed" "logged out" "restart required" "Stream Errored" "reconnect" "QR" "open"; do
    n=$(grep -ci "$pola" "$f" 2>/dev/null || echo 0)
    printf "    %-20s %s kali\n" "$pola" "$n"
  done
done
echo "  → 'logged out' = harus scan QR ulang (paling merepotkan)"
echo "  → 'connection closed' + 'reconnect' berimbang = gateway pulih sendiri"

garis "Rotasi log"
if pm2 list 2>/dev/null | grep -q logrotate; then
  echo "  pm2-logrotate TERPASANG"
  pm2 conf pm2-logrotate 2>/dev/null | sed 's/^/    /'
else
  echo "  pm2-logrotate BELUM terpasang — log tumbuh tanpa batas"
  echo "    pasang: pm2 install pm2-logrotate"
fi

garis "Ukuran seluruh log PM2"
du -sh ~/.pm2/logs 2>/dev/null | sed 's/^/  /'
df -h / | sed 's/^/  /'

printf '\n\033[1mSelesai. Kirim seluruh keluaran di atas.\033[0m\n'
