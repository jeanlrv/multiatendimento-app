FROM node:22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache curl

# Argumentos de build para variáveis NEXT_PUBLIC_* (injetadas no build time)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG BACKEND_URL
ARG BACKEND_INTERNAL_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV BACKEND_URL=$BACKEND_URL
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

# Stage 2 - Production
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/next-build ./next-build
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.js ./

ENV NODE_ENV=production

# Railway injeta PORT automaticamente (geralmente 3000 ou 8080)
# NÃO definir PORT fixo aqui!
EXPOSE 3000

CMD ["npm", "run", "start"]