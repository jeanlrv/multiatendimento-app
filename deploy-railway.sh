#!/bin/bash

# ============================================
# MultiAtendimento - Railway Deploy Script
# ============================================
# Este script automatiza a preparação do projeto para deploy no Railway

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  MultiAtendimento - Railway Deploy${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================
# VERIFICAÇÕES INICIAIS
# ============================================

echo -e "${YELLOW}[1/6] Verificando ambiente...${NC}"

# Verificar se está no diretório correto
if [ ! -f "backend/Dockerfile" ]; then
    echo -e "${RED}ERRO: Este script deve ser executado na raiz do projeto!${NC}"
    exit 1
fi

# Verificar se git está configurado
if [ ! -d ".git" ]; then
    echo -e "${RED}ERRO: Não é um repositório git!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Ambiente verificado${NC}"
echo ""

# ============================================
# GERAR CHAVES DE SEGURANÇA
# ============================================

echo -e "${YELLOW}[2/6] Gerando chaves de segurança...${NC}"

# Verificar se openssl está disponível
if ! command -v openssl &> /dev/null; then
    echo -e "${YELLOW}openssl não encontrado, usando chaves de exemplo${NC}"
    JWT_SECRET="exemplo-jwt-secret-32-caracteres!"
    JWT_REFRESH_SECRET="exemplo-refresh-32-caracteres!"
    ENCRYPTION_KEY="exemplo-encrypt-32-caracteres!"
else
    echo -e "${BLUE}Gerando chaves seguras com openssl...${NC}"
    JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
    JWT_REFRESH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
    ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
fi

echo -e "${GREEN}✓ Chaves geradas${NC}"
echo ""
echo -e "${BLUE}Chaves geradas:${NC}"
echo "  JWT_SECRET: ${JWT_SECRET:0:10}..."
echo "  JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:0:10}..."
echo "  ENCRYPTION_KEY: ${ENCRYPTION_KEY:0:10}..."
echo ""

# ============================================
# CRIAR .ENV PARA RAILWAY
# ============================================

echo -e "${YELLOW}[3/6] Criando arquivo .env para Railway...${NC}"

cat > .env << EOF
# ============================================
# MULTIATENDIMENTO - Railway Configuration
# ============================================

# BANCO DE DADOS (Obrigatório - Railway fornece automaticamente)
DATABASE_URL=\${DATABASE_URL}

# SEGURANÇA (Obrigatório)
JWT_SECRET="${JWT_SECRET}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}"
ENCRYPTION_KEY="${ENCRYPTION_KEY}"

# REDIS (Opcional - Railway fornece automaticamente)
REDIS_URL=\${REDIS_URL}

# APLICAÇÃO
NODE_ENV="production"
PORT=3000

# CONTROLE DE DEPLOY
SEED_ON_STARTUP="true"

# CORS
CORS_ORIGIN="*"
EOF

echo -e "${GREEN}✓ .env criado${NC}"
echo ""

# ============================================
# VERIFICAR DOCKERFILE
# ============================================

echo -e "${YELLOW}[4/6] Verificando Dockerfile...${NC}"

if [ ! -f "backend/Dockerfile" ]; then
    echo -e "${RED}ERRO: backend/Dockerfile não encontrado!${NC}"
    exit 1
fi

# Verificar se HEALTHCHECK está presente
if grep -q "HEALTHCHECK" backend/Dockerfile; then
    echo -e "${GREEN}✓ HEALTHCHECK configurado${NC}"
else
    echo -e "${YELLOW}⚠ HEALTHCHECK não encontrado${NC}"
fi

# Verificar se entrypoint.sh está presente
if [ -f "backend/entrypoint.sh" ]; then
    echo -e "${GREEN}✓ entrypoint.sh encontrado${NC}"
else
    echo -e "${RED}ERRO: backend/entrypoint.sh não encontrado!${NC}"
    exit 1
fi

echo ""

# ============================================
# VERIFICAR SEED
# ============================================

echo -e "${YELLOW}[5/6] Verificando seed.ts...${NC}"

if [ -f "backend/src/prisma/seed.ts" ]; then
    if grep -q "SEED_ON_STARTUP" backend/src/prisma/seed.ts; then
        echo -e "${GREEN}✓ Seed configurado para execução condicional${NC}"
    else
        echo -e "${YELLOW}⚠ Seed pode não estar configurado corretamente${NC}"
    fi
else
    echo -e "${RED}ERRO: backend/src/prisma/seed.ts não encontrado!${NC}"
    exit 1
fi

echo ""

# ============================================
# COMMIT E PUSH
# ============================================

echo -e "${YELLOW}[6/6] Preparando commit e push...${NC}"

# Adicionar todas as alterações
git add .

# Verificar se há alterações
CHANGED_FILES=$(git status --porcelain | wc -l)
if [ "$CHANGED_FILES" -eq 0 ]; then
    echo -e "${GREEN}✓ Nenhuma alteração para commit${NC}"
else
    echo -e "${BLUE}Alterações detectadas:${NC}"
    git status --porcelain
    echo ""
    
    # Perguntar se deseja commitar
    read -p "Deseja commitar as alterações? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git commit -m "Preparação para deploy Railway [skip ci]"
        git push origin main
        echo -e "${GREEN}✓ Commit e push realizados${NC}"
    else
        echo -e "${YELLOW}⚠ Commit e push pulados${NC}"
    fi
fi

echo ""

# ============================================
# RESUMO
# ============================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Deploy Preparado com Sucesso!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Próximos passos:${NC}"
echo ""
echo "1. Acesse https://railway.app"
echo "2. Crie um novo projeto"
echo "3. Adicione os serviços:"
echo "   - PostgreSQL (Database)"
echo "   - Redis (Opcional - para Workflows)"
echo "   - Backend (root: ./backend)"
echo "   - Frontend (root: ./frontend)"
echo ""
echo "4. Configure as variáveis de ambiente:"
echo "   Backend:"
echo "   - DATABASE_URL (automático)"
echo "   - JWT_SECRET: ${JWT_SECRET:0:10}..."
echo "   - JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:0:10}..."
echo "   - ENCRYPTION_KEY: ${ENCRYPTION_KEY:0:10}..."
echo "   - REDIS_URL (automático se Redis adicionado)"
echo "   - SEED_ON_STARTUP: true"
echo ""
echo "   Frontend:"
echo "   - NEXT_PUBLIC_API_URL: https://seu-backend.railway.app"
echo "   - NEXT_PUBLIC_WS_URL: wss://seu-backend.railway.app"
echo ""
echo "5. Após o primeiro deploy, mude SEED_ON_STARTUP para false"
echo ""
echo -e "${YELLOW}Documentação completa:${NC}"
echo "  - backend/docs/RAILWAY_DEPLOY_GUIDE.md"
echo "  - backend/docs/ANALISE_CORRECOES.md"
echo ""
echo -e "${GREEN}Boa sorte com o deploy! 🚀${NC}"