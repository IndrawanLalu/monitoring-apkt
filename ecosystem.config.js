module.exports = {
  apps: [{
    name: 'monitoring-apkt',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/monitoring-apkt',
    env: {
      NODE_ENV: 'production',
      CHROME_PATH: '/opt/google/chrome/google-chrome',
    },
  }],
}
