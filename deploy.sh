#!/bin/bash

# KSZap - Script de Deploy de Um Clique (Ubuntu/Debian)
# Este script configura Docker, SSL e as instâncias do KSZap.

set -e

echo "🚀 Iniciando Deploy KSZap SaaS..."

# 1. Atualização do Sistema
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git docker.io docker-compose

# 2. Configuração de Variáveis (Ajuste conforme necessário)
echo "--------------------------------------------------"
echo "Configurando Variáveis de Ambiente..."
echo "--------------------------------------------------"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️ .env.example copiado para .env. Por favor, edite as chaves de API e senhas!"
fi

# 3. Docker Compose - Build e Up
echo "📦 Subindo Containers (Backend, Frontend, Redis, Postgres)..."
sudo docker-compose up -d --build

# 4. Rodar Migrações do Banco
echo "📂 Executando Migrações Prisma..."
sudo docker-compose exec backend npx prisma migrate deploy
sudo docker-compose exec backend npx prisma generate

# 5. Configuração de SSL (Certbot/Nginx)
# Nota: Requer que o domínio já esteja apontado para o IP do servidor.
echo "🔐 Deseja configurar SSL automaticamente (Certbot)? [s/N]"
read install_ssl

if [ "$install_ssl" == "s" ]; then
  sudo apt-get install -y certbot python3-certbot-nginx
  echo "Digite seu domínio (ex: app.kszap.com):"
  read domain
  sudo certbot --nginx -d $domain
fi

echo "--------------------------------------------------"
echo "✅ Deploy Concluído com Sucesso!"
echo "Acesse seu sistema em breve no domínio configurado."
echo "--------------------------------------------------"
