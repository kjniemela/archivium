#!/bin/sh
set -e

SRC="$HOME/archivium/dev/nginx.conf"
DEST="/etc/nginx/sites-available/archivium"
ENABLED="/etc/nginx/sites-enabled/archivium"

if [ ! -f "$SRC" ]; then
  echo "Missing $SRC - copy the live config into the repo first." >&2
  exit 1
fi

if [ -f "$DEST" ]; then
  if diff -u "$DEST" "$SRC"; then
    echo "Live config already matches the repo, nothing to do."
    exit 0
  fi
  echo "---- Above: changes that will be applied (live -> repo) ----"
  BACKUP=$(mktemp)
  sudo cp "$DEST" "$BACKUP"
fi

echo "Installing nginx config..."
sudo cp "$SRC" "$DEST"

if [ ! -e "$ENABLED" ]; then
  echo "Enabling site (symlinking into sites-enabled)..."
  sudo ln -s "$DEST" "$ENABLED"
  LINKED=1
fi

echo "Testing nginx config..."
if ! sudo nginx -t; then
  echo "Config test failed." >&2
  if [ -n "$BACKUP" ]; then
    echo "Restoring previous config..." >&2
    sudo cp "$BACKUP" "$DEST"
  else
    echo "Removing new config..." >&2
    sudo rm -f "$DEST"
  fi
  [ -n "$LINKED" ] && sudo rm -f "$ENABLED"
  exit 1
fi

echo "Reloading nginx..."
sudo nginx -s reload
echo "Done."
