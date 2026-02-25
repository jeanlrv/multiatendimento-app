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
  echo "⚠️ Erro no migrate deploy. Tentando resolver migrações falhas conhecidas (P3009)..."
  ./node_modules/.bin/prisma migrate resolve --applied 20260222000001_sync_schema_roles_collaboration || true
  ./node_modules/.bin/prisma migrate resolve --applied 20260222000002_users_roleid_not_null || true
  ./node_modules/.bin/prisma migrate resolve --applied 20260222000003_indexes_columns_fixes || true
  
  echo "📦 Segunda tentativa de migrate deploy..."
  ./node_modules/.bin/prisma migrate deploy || {
    echo "⚠️ Falha persistente na migração. Tentando db push como último recurso..."
    ./node_modules/.bin/prisma db push --accept-data-loss
  }
}

echo "✅ Banco de dados sincronizado."

echo "🚀 Iniciando aplicação..."

# Procura pelo arquivo main.js em locais comuns
if [ -f "dist/main.js" ]; then
  exec node dist/main.js
elif [ -f "dist/src/main.js" ]; then
  echo "ℹ️ main.js encontrado em dist/src/main.js"
  exec node dist/src/main.js
else
  echo "❌ ERRO: main.js não encontrado em dist/ nem dist/src/!"
  echo "Contatos do diretório dist:"
  ls -R dist || echo "Diretório dist não existe."
  exit 1
fi
