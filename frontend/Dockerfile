# =========================
# Production
# =========================
FROM node:18-alpine AS production

WORKDIR /app
RUN apk add --no-cache curl

# Variáveis de Build
ARG BACKEND_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

# Exportar para Ambiente (Acessível durante build e runtime)
ENV BACKEND_URL=$BACKEND_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NODE_ENV=production
ENV PORT=8080

# Aumenta o Heap do Node para o Build
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Build do Next.js (Aqui o BACKEND_URL é lido pelo next.config.js)
RUN npm run build

# Remover devDependencies
RUN npm prune --omit=dev

EXPOSE 8080

# Comando para iniciar o servidor de produção
CMD ["npm", "run", "start"]
