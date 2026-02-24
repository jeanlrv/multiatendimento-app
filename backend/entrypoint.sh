#!/bin/sh
set -e

echo "⏳ Aguardando banco de dados..."

# Tenta rodar migrations
echo "📦 Executando Prisma migrate deploy..."
npx prisma migrate deploy || {
  echo "⚠️ Migrate deploy falhou, tentando db push com --accept-data-loss..."
  npx prisma db push --accept-data-loss
}

# Opcional: npx prisma db seed
# npx prisma db seed || echo "⚠️ Seed já executado ou falhou (ignorando)"

echo "✅ Banco de dados sincronizado."

echo "🚀 Iniciando aplicação..."
exec "$@"
