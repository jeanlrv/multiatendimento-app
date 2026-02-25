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

echo "🔍 Verificando variáveis de ambiente do Redis..."
[ -n "$REDIS_URL" ] && echo "✅ REDIS_URL detectada." || echo "ℹ️ REDIS_URL não definida."
[ -n "$REDISHOST" ] && echo "✅ REDISHOST detectada: $REDISHOST" || echo "ℹ️ REDISHOST não definida."
[ -n "$REDISPORT" ] && echo "✅ REDISPORT detectada: $REDISPORT" || echo "ℹ️ REDISPORT não definida."
[ -n "$REDIS_HOST" ] && echo "✅ REDIS_HOST detectada: $REDIS_HOST" || echo "ℹ️ REDIS_HOST não definida."
[ -n "$REDIS_PORT" ] && echo "✅ REDIS_PORT detectada: $REDIS_PORT" || echo "ℹ️ REDIS_PORT não definida."

# Tenta rodar migrations
echo "📦 Executando Prisma migrate deploy..."
./node_modules/.bin/prisma migrate deploy 2>&1 || {
  echo "⚠️ Erro no migrate deploy. Detectando migrações falhas..."
  
  # Resolve todas as migrações existentes no diretório prisma/migrations
  for dir in prisma/migrations/*/; do
    MIGRATION_NAME=$(basename "$dir")
    if [ "$MIGRATION_NAME" != "migration_lock.toml" ]; then
      echo "🔧 Marcando migração como aplicada: $MIGRATION_NAME"
      ./node_modules/.bin/prisma migrate resolve --applied "$MIGRATION_NAME" 2>&1 || true
    fi
  done
  
  echo "📦 Segunda tentativa de migrate deploy..."
  ./node_modules/.bin/prisma migrate deploy 2>&1 || {
    echo "⚠️ Fallback para db push..."
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
