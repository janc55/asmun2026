#!/bin/sh
set -e

echo "==> Verificando y aplicando migraciones de base de datos..."
npx prisma migrate deploy

echo "==> Iniciando backend NestJS en producción..."
exec node dist/main
