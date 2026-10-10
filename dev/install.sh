#!/bin/sh

REPO="$HOME/archivium"

for cmd in git node npm pm2 nginx; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
done

cd "$REPO" || exit 1

echo "Deploying nginx config..."
./dev/deploy-nginx.sh || exit 1

SUDO=""
[ "$(id -u)" -eq 0 ] || SUDO="sudo"
$SUDO mkdir -p /var/www/archivium /var/www/html

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm ci || exit 1
fi

sh ./dev/pull-update.sh

if [ ! -f dist/index.js ]; then
  echo "Build output not found!" >&2
  exit 1
fi

if ! pm2 describe archivium >/dev/null 2>&1; then
  echo "Registering archivium with pm2..."
  pm2 start ecosystem.config.cjs || exit 1
fi
pm2 save
