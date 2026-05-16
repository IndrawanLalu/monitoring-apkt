#!/bin/bash
set -e

# ─── Warna output ────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

ok()   { echo -e "${GREEN}✔ $1${NC}"; }
info() { echo -e "${CYAN}» $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✘ $1${NC}"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       DEPLOY — MONITORING APKT       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ─── 1. Guard: pastikan .env ada ─────────────────────────────
info "Mengecek file .env..."
if [ ! -f .env ]; then
  fail ".env tidak ditemukan! Buat dulu:\n   nano /var/www/monitoring-apkt/.env"
fi
ok ".env ditemukan"

# ─── 2. Git pull ──────────────────────────────────────────────
info "Mengambil update dari GitHub (git pull)..."
git pull origin main
ok "Git pull selesai"

# ─── 3. Install dependencies ──────────────────────────────────
info "Menginstall dependencies (pnpm install)..."
pnpm install --frozen-lockfile
ok "Dependencies terinstall"

# ─── 4. Build Next.js ─────────────────────────────────────────
info "Build aplikasi (pnpm build)..."
pnpm run build
ok "Build selesai"

# ─── 5. Restart PM2 ───────────────────────────────────────────
info "Merestart proses PM2..."
pm2 restart all
ok "PM2 direstart"

# ─── 6. Simpan state PM2 ──────────────────────────────────────
pm2 save --force > /dev/null 2>&1
ok "PM2 state tersimpan"

# ─── 7. Status akhir ──────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         DEPLOY SELESAI ✔             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""
pm2 list
echo ""
