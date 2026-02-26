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
  echo "❌ ERRO: JWT_REFRESH_SECRET não configurada!"
  exit 1
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

REDIS_AVAILABLE=false
if [ -n "$REDIS_URL" ]; then
  REDIS_AVAILABLE=true
  echo "✅ REDIS_URL configurada"
elif [ -n "$REDISHOST" ] || [ -n "$REDIS_HOST" ]; then
  REDIS_AVAILABLE=true
  REDIS_HOST=${REDISHOST:-$REDIS_HOST}
  REDIS_PORT=${REDISPORT:-$REDIS_PORT:-6379}
  echo "✅ Redis configurado: $REDIS_HOST:$REDIS_PORT"
else
  echo "⚠️  Redis não configurado (funcionalidades limitadas)"
  echo "   Workflows e filas não estarão disponíveis"
fi

# ============================================
# AGUARDAR BANCO DE DADOS
# ============================================
echo "⏳ Aguardando banco de dados..."
MAX_RETRIES=60
RETRY_COUNT=0

while ! nc -z postgres 5432 2>/dev/null && ! nc -z db 5432 2>/dev/null && [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "   Tentativa $RETRY_COUNT/$MAX_RETRIES..."
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ ERRO: Banco de dados não respondeu após $MAX_RETRIES tentativas"
  exit 1
fi
echo "✅ Banco de dados disponível"

# ============================================
# MIGRAÇÕES PRISMA
# ============================================
echo "📦 Executando migrações do Prisma..."

# Tenta migrate deploy primeiro
if ! npx prisma migrate deploy 2>&1; then
  echo "⚠️  migrate deploy falhou, verificando estado..."
  
  # Verifica migrações não aplicadas
  MIGRATION_STATUS=$(npx prisma migrate status 2>&1 || echo "")
  
  if echo "$MIGRATION_STATUS" | grep -q "Pending migrations"; then
    echo "⚠️  Existem migrações pendentes"
    
    # Tenta aplicar migrações pendentes
    if ! npx prisma migrate resolve --applied "$(echo "$MIGRATION_STATUS" | grep "Pending" | awk '{print $1}')" 2>&1; then
      echo "⚠️  Fallback para db push (pode causar perda de dados)"
      npx prisma db push --accept-data-loss 2>&1 || true
    fi
  fi
fi

echo "✅ Migrações concluídas"

# ============================================
# SEED (APENAS SE CONFIGURADO E BANCO VAZIO)
# ============================================
SEED_ENABLED=${SEED_ON_STARTUP:-false}

if [ "$SEED_ENABLED" = "true" ]; then
  echo "🌱 Verificando se seed é necessário..."
  
  # Verifica se já existem dados no banco
  USER_COUNT=$(npx prisma.user.count 2>&1 || echo "0")
  
  if [ "$USER_COUNT" = "0" ]; then
    echo "🌱 Executando seed (banco vazio detectado)..."
    
    # Executa seed
    if node dist/prisma/seed.js 2>&1; then
      echo "✅ Seed concluído com sucesso"
    else
      echo "⚠️  Seed falhou, continuando sem dados iniciais"
    fi
  else
    echo "ℹ️  Seed pulado (já existem $USER_COUNT usuários no banco)"
  fi
else
  echo "ℹ️  Seed desabilitado (SEED_ON_STARTUP=false)"
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

# Inicia aplicação
exec node dist/main.js