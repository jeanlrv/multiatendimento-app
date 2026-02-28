FROM node:22-alpine AS builder

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
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# Usaremos o Next.js build convencional sem output standalone pois Railway aceita a pasta total
RUN npm run build

# Stage 2 - Production
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copiar a build do Next e Node Modules de uma vez
COPY --from=builder /app/next-build ./next-build
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]