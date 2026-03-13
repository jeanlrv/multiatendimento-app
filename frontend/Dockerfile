FROM node:20-alpine AS builder

WORKDIR /app
RUN apk add --no-cache curl

# Argumentos de build para variáveis NEXT_PUBLIC_*
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG BACKEND_URL
ARG BACKEND_INTERNAL_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV BACKEND_URL=$BACKEND_URL
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ENV NODE_OPTIONS="--max-old-space-size=6144"

# Copiar apenas manifests primeiro — preserva cache da layer de dependências
COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# Build gera next-build/standalone/ (output: standalone no next.config.js)
RUN npm run build

# ── Stage 2: Runner mínimo (sem node_modules completo) ───────────────────────
# A pasta standalone já inclui apenas os node_modules necessários (~50-100 MB)
# vs copiar node_modules inteiro (~1 GB)
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Standalone output: contém server.js + node_modules mínimos + estrutura next-build/
COPY --from=builder /app/next-build/standalone ./

# Arquivos estáticos (JS/CSS do cliente) — necessários para o server.js servir
COPY --from=builder /app/next-build/static ./next-build/static

# Arquivos públicos (imagens, ícones, SW do PWA gerado pelo next-pwa)
COPY --from=builder /app/public ./public

EXPOSE 3000

# server.js é gerado pelo Next.js standalone — inicia sem "next start"
CMD ["node", "server.js"]
