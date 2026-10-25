#!/data/data/com.termux/files/usr/bin/bash
# Deploy game ke Vercel.
# Pakai token (disarankan, non-interaktif):
#   VERCEL_TOKEN=xxxx ./deploy.sh
# Atau login interaktif dulu:
#   vercel login
set -e
cd "$(dirname "$0")"

if [ -n "$VERCEL_TOKEN" ]; then
  echo ">> Deploy memakai VERCEL_TOKEN (production)"
  vercel deploy --prod --yes --token "$VERCEL_TOKEN"
else
  echo ">> Deploy tanpa token (perlu sudah 'vercel login')"
  vercel deploy --prod --yes
fi
