# =========================
# Development
# =========================
FROM node:18-alpine AS development

WORKDIR /app
RUN apk add --no-cache curl

# AUMENTA O HEAP DO NODE
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]


# =========================
# Production
# =========================
FROM node:18-alpine AS production

WORKDIR /app
RUN apk add --no-cache curl

# AUMENTA O HEAP DO NODE PARA BUILD
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# BUILD COM MAIS MEMÓRIA
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN npm run build

# Remover devDependencies após build
RUN npm prune --omit=dev

EXPOSE 3000

CMD ["npm", "run", "start"]
