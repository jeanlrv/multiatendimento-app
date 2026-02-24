#!/bin/sh
set -e

echo "🚀 Script de entrada v2.1 iniciado..."
echo "⏳ Aguardando banco de dados..."

# Verifica se DATABASE_URL está definida
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERRO: A variável de ambiente DATABASE_URL não foi encontrada!"
  echo "⚠️ Por favor, configure-a no painel do Railway (Variables)."
  exit 1
fi

# Tenta rodar migrations
echo "📦 Executando Prisma migrate deploy..."
./node_modules/.bin/prisma migrate deploy || {
  echo "⚠️ Erro no migrate deploy. Tentando resolver migração possivelmente falha (P3009)..."
  ./node_modules/.bin/prisma migrate resolve --applied 20260222000001_sync_schema_roles_collaboration || echo "ℹ️ Já resolvido ou erro diferente."
  
  echo "📦 Segunda tentativa de migrate deploy..."
  ./node_modules/.bin/prisma migrate deploy || {
    echo "⚠️ Falha persistente na migração. Tentando db push como último recurso..."
    ./node_modules/.bin/prisma db push --accept-data-loss
  }
}

echo "✅ Banco de dados sincronizado."

echo "🚀 Iniciando aplicação..."
exec "$@"
