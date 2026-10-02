#!/bin/sh
rm -rf /var/www/archivium/static/
cp -r ~/archivium/dist/static /var/www/archivium/static
rm -f /var/www/html/maintainence.html
cp -r ~/archivium/dev/maintainence.html /var/www/html/maintainence.html
