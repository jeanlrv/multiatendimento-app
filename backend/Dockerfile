# Stage 1 - Build
FROM node:20-slim AS builder

# Instalar dependências necessárias para build e Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    python3 \
    python3-pip \
    python3-setuptools \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar package files primeiro para cache otimizado
COPY package*.json ./

# Instalar todas as dependências (dev + prod)
# node:20-slim usa glibc — fastembed e onnxruntime-node têm binários para linux-x64-gnu
RUN npm ci --legacy-peer-deps

# Copiar código fonte e schema Prisma
COPY prisma ./prisma
COPY . .

# Gerar Prisma Client (forçando versão 6)
RUN npx prisma@6 generate

# Compilar aplicação
RUN npm run build

# Stage 2 - Production
FROM node:20-slim

# Definir limite de memória elevado (6GB) para o plano Hobby do Railway
ENV NODE_OPTIONS="--max-old-space-size=6144"

# Instalar apenas o necessário para runtime (Prisma precisa de openssl; nc para health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

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

# NOTA: USER node removido — volumes Railway são montados como root:root (755)
# e o usuário node não consegue criar arquivos dentro deles (EACCES).
# Railway já isola containers; rodar como root é seguro neste ambiente.

# Health check para o Railway e Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Porta (Railway injeta PORT via variável de ambiente)
EXPOSE 3000

# Entrypoint gerencia migrações e seed antes de iniciar
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
