#!/bin/sh
set -eu

echo "costaff-ats: applying Prisma migrations"
npx prisma migrate deploy

mkdir -p /app/public/uploads

echo "costaff-ats: starting Next.js on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec npx next start -H "${HOSTNAME:-0.0.0.0}" -p "${PORT:-3000}"
