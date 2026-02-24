# Stage 1 - Build
FROM node:18-alpine AS builder

# Instalar dependências necessárias para o Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
# Usamos legacy-peer-deps para evitar conflitos conhecidos de versões de dependências
RUN npm install --legacy-peer-deps

COPY . .

# Gerar o Prisma Client (usamos env dummy para evitar falhas de validação no build)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Compilar a aplicação NestJS
RUN npm run build

# Stage 2 - Production
FROM node:18-alpine

# Instalar dependências necessárias para o Prisma em runtime
RUN apk add --no-cache openssl libc6-compat curl

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copiar artefatos do estágio builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copiar e configurar o entrypoint para rodar migrações
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# A porta será definida pelo Railway via process.env.PORT, mas expomos a 3000 por padrão
EXPOSE 3000

ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "dist/main.js"]
