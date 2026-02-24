# Development
FROM node:18-alpine AS development

RUN apk add --no-cache openssl libc6-compat curl

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate

# Entrypoint para migrar banco e seed antes de iniciar
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3002

ENTRYPOINT ["entrypoint.sh"]
CMD ["npm", "run", "start:dev"]

# Production
FROM node:18-alpine AS production

RUN apk add --no-cache openssl libc6-compat curl

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate
RUN npm run build

# Remover devDependencies após build
RUN npm prune --omit=dev --legacy-peer-deps

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3002

ENTRYPOINT ["entrypoint.sh"]
CMD ["npm", "run", "start:prod"]
