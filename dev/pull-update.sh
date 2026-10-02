#!/bin/sh

cd ~/archivium

echo "Pulling updates from GitHub..."
git pull

echo "Stopping server..."
pm2 stop archivium

echo "Rebuilding..."
npm run build:all

echo "Upgrading DB..."
npm run db:upgrade

echo "Copying static assets..."
./dev/deploy-static.sh

echo "Restarting server..."
pm2 start archivium
