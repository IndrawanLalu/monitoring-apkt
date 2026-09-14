module.exports = {
  apps: [{
    name: 'monitoring-apkt',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/monitoring-apkt',
    env: {
      NODE_ENV: 'production',
      // 4000, bukan 3000 bawaan Next.js. Diminta tim IT karena 3000 sudah
      // dipakai di lingkungan mereka. Dibaca `next start` saat jalan, jadi
      // mengubahnya tidak butuh build ulang — cukup restart --update-env.
      PORT: 4000,
      CHROME_PATH: '/opt/google/chrome/google-chrome',
    },
  }],
}
