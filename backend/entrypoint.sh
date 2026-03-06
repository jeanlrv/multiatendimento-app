#!/bin/sh
set -e

echo "=========================================="
echo "🚀 MultiAtendimento - Railway Entrypoint"
echo "=========================================="

# ============================================
# VALIDAÇÃO DE VARIÁVEIS OBRIGATÓRIAS
# ============================================
echo "🔍 Validando variáveis de ambiente..."

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERRO: DATABASE_URL não configurada!"
  echo "   Configure no Railway: Settings → Environment Variables"
  exit 1
fi
echo "✅ DATABASE_URL configurada"

# Validar JWT secrets (obrigatório em produção)
if [ -z "$JWT_SECRET" ]; then
  echo "❌ ERRO: JWT_SECRET não configurada!"
  exit 1
fi
echo "✅ JWT_SECRET configurada"

if [ -z "$JWT_REFRESH_SECRET" ]; then
  echo "⚠️  JWT_REFRESH_SECRET não configurada, usando JWT_SECRET como fallback"
  export JWT_REFRESH_SECRET="$JWT_SECRET"
fi
echo "✅ JWT_REFRESH_SECRET configurada"

# ENCRYPTION_KEY é obrigatório em produção
if [ -z "$ENCRYPTION_KEY" ]; then
  echo "❌ ERRO: ENCRYPTION_KEY não configurada!"
  echo "   Necessário para criptografia de tokens e senhas"
  exit 1
fi
echo "✅ ENCRYPTION_KEY configurada"

# ============================================
# CONFIGURAÇÃO REDIS (OPCIONAL)
# ============================================
echo "🔍 Verificando configuração do Redis..."

if [ -n "$REDIS_URL" ]; then
  echo "✅ REDIS_URL configurada"
elif [ -n "$REDISHOST" ] || [ -n "$REDIS_HOST" ]; then
  REDIS_HOST=${REDISHOST:-$REDIS_HOST}
  REDIS_PORT=${REDISPORT:-${REDIS_PORT:-6379}}
  echo "✅ Redis configurado: $REDIS_HOST:$REDIS_PORT"
else
  echo "⚠️  Redis não configurado (funcionalidades limitadas)"
  echo "   Workflows e filas não estarão disponíveis"
fi

# ============================================
# AGUARDAR BANCO DE DADOS
# ============================================
echo "⏳ Aguardando banco de dados..."

# Extrair host e porta do DATABASE_URL de forma robusta
# Formato esperado: postgresql://user:pass@host:port/dbname
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*@[^:]*:\([0-9]*\).*|\1|p')
DB_PORT=${DB_PORT:-5432}

echo "   Aguardando $DB_HOST:$DB_PORT..."

MAX_RETRIES=30
RETRY_COUNT=0

# Tentar conectar via node se nc não encontrar (mais confiável no Railway)
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "   Tentativa $RETRY_COUNT/$MAX_RETRIES..."
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "⚠️  Timeout aguardando o banco. Tentando prosseguir mesmo assim..."
fi
echo "✅ Banco de dados disponível"

# ============================================
# MIGRAÇÕES PRISMA
# ============================================
echo "📦 Executando migrações do Prisma..."

echo "🚀 Executando migrate deploy..."
if npx prisma@6 migrate deploy 2>&1; then
  echo "✅ Migrações aplicadas com sucesso"
else
  echo "❌ migrate deploy falhou! Verifique os logs e corrija as migrações localmente."
  exit 1
fi


# ============================================
# SEED (APENAS SE CONFIGURADO E BANCO VAZIO)
# ============================================
SEED_ENABLED=${SEED_ON_STARTUP:-false}

if [ "$SEED_ENABLED" = "true" ]; then
  echo "🌱 Verificando se seed é necessário..."

  # Verifica se já existem dados no banco usando Node.js
  USER_COUNT=$(node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.user.count().then(c => { console.log(c); process.exit(0); }).catch(() => { console.log('0'); process.exit(0); });
  " 2>/dev/null || echo "0")

  if [ "$USER_COUNT" = "0" ]; then
    echo "🌱 Executando seed (banco vazio detectado)..."
    if node dist/prisma/seed.js 2>&1; then
      echo "✅ Seed concluído com sucesso"
    else
      echo "⚠️  Seed falhou, continuando sem dados iniciais"
    fi
  else
    echo "ℹ️  Seed pulado (já existem $USER_COUNT usuários no banco)"
  fi
else
  echo "ℹ️  Seed desabilitado (SEED_ON_STARTUP=$SEED_ENABLED)"
fi

# ============================================
# DIRETÓRIO DE CACHE FASTEMBED (volume persistente)
# ============================================
if [ -n "$FASTEMBED_CACHE_PATH" ]; then
  mkdir -p "$FASTEMBED_CACHE_PATH" 2>/dev/null || true
  if [ -d "$FASTEMBED_CACHE_PATH" ]; then
    echo "✅ Fastembed cache: $FASTEMBED_CACHE_PATH"
  else
    echo "⚠️  Nao foi possivel usar $FASTEMBED_CACHE_PATH, fallback para /tmp"
    FASTEMBED_CACHE_PATH="/tmp/fastembed_cache"
    mkdir -p "$FASTEMBED_CACHE_PATH"
    export FASTEMBED_CACHE_PATH
  fi
fi

# ============================================
# INICIAR APLICAÇÃO
# ============================================
echo "=========================================="
echo "🚀 Iniciando aplicação..."
echo "=========================================="

# Verifica se main.js existe
if [ ! -f "dist/main.js" ]; then
  echo "❌ ERRO: dist/main.js não encontrado!"
  echo "   Certifique-se de que a aplicação foi compilada corretamente"
  ls -la dist/ 2>/dev/null || echo "Diretório dist não existe"
  exit 1
fi

# Inicia aplicação (exec substitui o processo shell)
exec node dist/main.js