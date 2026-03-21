# 🔧 Correção de Erros - Guia Rápido

## ✅ Problemas Corrigidos

### 1. Docker Build - package-lock.json
**Problema**: `npm ci` requer `package-lock.json`  
**Solução**: Dockerfiles atualizados para usar `npm install`

### 2. PowerShell Execution Policy
**Problema**: Scripts npm/npx bloqueados no Windows  
**Solução**: Use os comandos abaixo

### 3. Erro P1012 - Prisma 7 (BREAKING CHANGE)
**Problema**: `The datasource property url is no longer supported in schema files.`  
**Solução**: O projeto depende do Prisma v6. Use sempre `npx prisma@6` em vez de apenas `npx prisma`. O Prisma 7 removeu o suporte direto ao `env("DATABASE_URL")` no schema sem configuração extra.

---

## 🚀 Como Iniciar Agora

### 1️⃣ Limpe os containers anteriores

```powershell
docker-compose down -v
```

### 2️⃣ Reconstrua e inicie

```powershell
docker-compose up -d --build
```

### 3️⃣ Aguarde os containers iniciarem

```powershell
# Veja os logs
docker-compose logs -f
```

### 4️⃣ Execute migrations e seed

**Opção A - Dentro do container (recomendado):**

```powershell
docker exec -it whatsapp-backend sh
npx prisma migrate dev --name init
npm run seed
exit
```

**Opção B - Se o PowerShell bloquear scripts:**

```powershell
# Habilite temporariamente a execução de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# Agora pode usar npm/npx normalmente
docker exec -it whatsapp-backend sh
npx prisma migrate dev --name init
npm run seed
exit
```

---

## 🔍 Verificar Status

```powershell
# Ver containers rodando
docker ps

# Ver logs de um serviço específico
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
```

---

## ✅ Containers Esperados

Você deve ver 5 containers rodando:

- `whatsapp-postgres` - Banco de dados
- `whatsapp-redis` - Cache
- `whatsapp-backend` - API NestJS
- `whatsapp-frontend` - Next.js
- `whatsapp-nginx` - Reverse proxy

---

## 🌐 Acessar a Aplicação

Após todos os containers estarem rodando:

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001/api
- **Swagger**: http://localhost:3001/api/docs

---

## ⚠️ Troubleshooting

### Container não inicia

```powershell
# Ver logs detalhados
docker-compose logs -f [nome-do-serviço]
```

### Porta em uso

Edite `docker-compose.yml` e mude as portas:

```yaml
ports:
  - "3002:3000"  # Muda de 3000 para 3002
```

### Erro de permissão no PowerShell

Execute como Administrador ou use:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

---

## 📝 Próximos Passos

Após os containers iniciarem com sucesso:

1. ✅ Execute migrations: `npx prisma@6 migrate dev --name init`
2. ✅ Execute seed: `npm run seed`
3. ✅ Acesse http://localhost:3000
4. ✅ Faça login com: `admin@kszap.com` / `Admin@123`
