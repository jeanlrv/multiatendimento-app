# Stage 1 - Build
FROM node:22-alpine AS builder

# Instalar dependências necessárias para o Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copiar package files primeiro para cache otimizado
COPY package*.json ./

# Instalar dependências
RUN npm install --legacy-peer-deps

# Copiar código fonte
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Compilar aplicação
RUN npm run build

# Stage 2 - Production
FROM node:22-alpine

# Instalar dependências de runtime
RUN apk add --no-cache openssl libc6-compat curl netcat-openbsd

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências de produção
RUN npm install --omit=dev --legacy-peer-deps

# Copiar artefatos do build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copiar entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh

# Configurar permissões
RUN mkdir -p /app/public/uploads && \
    chown -R node:node /app

# Executar como usuário não-root
USER node

# Health check para verificação de saúde
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Porta (Railway define PORT via ambiente)
EXPOSE 3000

# Entrypoint e command
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]