# CARA RESTAR DI VPS

- Stop PM2
  pm2 stop all
- cd /var/www/smart-mataram && ./deploy.sh

# deploy.sh

#!/bin/bash
set -e

echo "=== DEPLOY START ==="

echo ">>> git pull..."
git pull origin main

echo ">>> pnpm install Next.js app..."
pnpm install # ← ganti dari npm install

echo ">>> build Next.js..."
pnpm run build # ← ganti dari npm run build

echo ">>> npm install wa-bot..."
cd /var/www/smart-mataram/wa-bot
npm install # wa-bot tetap pakai npm
cd /var/www/smart-mataram

echo ">>> restart PM2..."
pm2 restart all

echo "=== DEPLOY DONE ==="


# MONITORING APKT
cd /var/www/monitoring-apkt
pm2 stop monitoring-apkt
git pull
pnpm install
pnpm run build
pm2 restart monitoring-apkt