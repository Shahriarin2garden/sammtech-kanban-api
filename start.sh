#!/usr/bin/env bash
set -e

echo "=== Render startup debug ==="
echo "NODE_ENV=$NODE_ENV"
echo "PORT=$PORT"
echo "API_PREFIX=$API_PREFIX"
echo "DATABASE_URL=$(echo $DATABASE_URL | sed 's|://[^:]*:[^@]*@|://****:****@|')"
echo "JWT_ACCESS_SECRET len=${#JWT_ACCESS_SECRET}"
echo "JWT_REFRESH_SECRET len=${#JWT_REFRESH_SECRET}"
echo "=== Starting app ==="

npx prisma migrate deploy 2>&1
echo "=== Prisma migrate done ==="
exec node dist/main.js 2>&1