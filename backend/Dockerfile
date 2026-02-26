# Stage 1 - Build
FROM node:22-alpine AS builder

# Instalar dependências necessárias para o Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copiar package files primeiro para cache otimizado
COPY package*.json ./

# Instalar todas as dependências (dev + prod)
RUN npm install --legacy-peer-deps

# Copiar código fonte e schema Prisma
COPY prisma ./prisma
COPY . .

# Gerar Prisma Client (forçando versão 6)
RUN npx prisma@6 generate

# Compilar aplicação
RUN npm run build

# Stage 2 - Production
FROM node:22-alpine

# Instalar dependências de runtime
RUN apk add --no-cache openssl libc6-compat curl netcat-openbsd

WORKDIR /app

# Copiar artefatos do build e node_modules do builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copiar entrypoint e garantir permissões Unix
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh

# Configurar diretório de uploads e permissões
RUN mkdir -p /app/public/uploads && \
    chown -R node:node /app

# Executar como usuário não-root (segurança)
USER node

# Health check para o Railway e Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Porta (Railway injeta PORT via variável de ambiente)
EXPOSE 3000

# Entrypoint gerencia migrações e seed antes de iniciar
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]