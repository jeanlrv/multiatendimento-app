#!/bin/sh
set -e

echo "⏳ Aguardando banco de dados..."

# Verifica se DATABASE_URL está definida
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERRO: A variável de ambiente DATABASE_URL não foi encontrada!"
  echo "⚠️ Por favor, configure-a no painel do Railway (Variables)."
  exit 1
fi

# Tenta rodar migrations
echo "📦 Executando Prisma migrate deploy..."
npx prisma migrate deploy || {
  echo "⚠️ Migrate deploy falhou (pode ser a primeira execução), tentando db push..."
  npx prisma db push --accept-data-loss
}

# Opcional: npx prisma db seed
# npx prisma db seed || echo "⚠️ Seed já executado ou falhou (ignorando)"

echo "✅ Banco de dados sincronizado."

echo "🚀 Iniciando aplicação..."
exec "$@"
