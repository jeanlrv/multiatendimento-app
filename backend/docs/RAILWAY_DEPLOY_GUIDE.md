# 🚀 Guia de Deploy para Railway

Este guia explica como deployar o **MultiAtendimento** no [Railway.com](https://railway.app) com configuração otimizada e segura.

---

## 📋 Pré-requisitos

1. Conta no [Railway](https://railway.app)
2. Repositório Git com o código do projeto
3. Chaves de segurança geradas (veja seção abaixo)

---

## 🏗️ Arquitetura no Railway

```
┌───────────────────────────────────────────────────┐
│                  Railway Platform                  │
├───────────────────────────────────────────────────┤
│  ┌──────────────┐        ┌──────────────┐         │
│  │   Backend    │◄──────►│   Frontend   │         │
│  │  (NestJS)    │        │  (Next.js)   │         │
│  └──────┬───────┘        └──────────────┘         │
│         │                                          │
│  ┌──────▼───────┐        ┌──────────────┐         │
│  │  PostgreSQL  │        │    Redis     │         │
│  │  + pgvector  │        │  (Opcional)  │         │
│  └──────────────┘        └──────────────┘         │
└───────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> O Backend usa **Prisma 6** explicitamente (`npx prisma@6`). Não altere a versão do Prisma.

---

## 📦 Passo a Passo

### 1. Gerar Chaves de Segurança

Antes de tudo, gere suas chaves. Execute no terminal:

```bash
# Gerar 3 chaves seguras de uma vez
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
```

> [!CAUTION]
> Salve essas chaves em um local seguro! Você precisará delas no passo 4.

### 2. Criar Projeto no Railway

1. Acesse [railway.app](https://railway.app) → **"New Project"**
2. Selecione **"Deploy from GitHub repo"**
3. Autorize e escolha seu repositório

### 3. Adicionar Serviços de Infraestrutura

#### PostgreSQL (Obrigatório)

1. No projeto, clique **"+ New"** → **"PostgreSQL"**
2. O Railway fornece `DATABASE_URL` automaticamente
3. O `entrypoint.sh` aguarda o banco ficar disponível antes de rodar migrações

#### Redis (Opcional — para Workflows e Filas)

1. Clique **"+ New"** → **"Redis"**
2. O Railway fornece `REDIS_URL` automaticamente
3. Sem Redis, Workflows e processamento de fila de IA **não funcionarão**

### 4. Configurar Serviço Backend

1. Clique **"+ New"** → **"Deploy from GitHub"**
2. **Root Directory**: `backend`
3. Railway detectará o `Dockerfile` automaticamente

#### Variáveis de Ambiente (Backend)

Adicione no painel **Variables** do serviço:

| Variável | Obrigatório | Valor |
|:---|:---:|:---|
| `DATABASE_URL` | ✅ | `${{Postgres.DATABASE_URL}}` (referência automática) |
| `JWT_SECRET` | ✅ | Chave gerada no passo 1 |
| `JWT_REFRESH_SECRET` | ✅ | Chave gerada no passo 1 |
| `ENCRYPTION_KEY` | ✅ | Chave gerada no passo 1 |
| `REDIS_URL` | ⚠️ | `${{Redis.REDIS_URL}}` (se adicionou Redis) |
| `NODE_ENV` | ⚠️ | `production` |
| `SEED_ON_STARTUP` | ⚠️ | `true` (apenas no 1º deploy) |
| `CORS_ORIGIN` | ⚠️ | `https://seu-frontend.railway.app` |
| `OPENAI_API_KEY` | ⚠️ | `sk-...` (se usar IA) |

> [!TIP]
> Use a sintaxe `${{NomeDoServiço.VARIÁVEL}}` para referenciar automaticamente os addons do Railway.

### 5. Configurar Serviço Frontend

1. Clique **"+ New"** → **"Deploy from GitHub"**
2. **Root Directory**: `frontend`
3. Railway detectará o `Dockerfile` automaticamente

#### Variáveis de Ambiente (Frontend)

| Variável | Obrigatório | Valor |
|:---|:---:|:---|
| `NEXT_PUBLIC_API_URL` | ✅ | `https://seu-backend.railway.app` |
| `NEXT_PUBLIC_WS_URL` | ✅ | `wss://seu-backend.railway.app` |
| `BACKEND_URL` | ✅ | `https://seu-backend.railway.app` |

> [!WARNING]
> Variáveis `NEXT_PUBLIC_*` são injetadas no **build time**. Se alterar, faça um **Redeploy** do frontend.

---

## 🚀 Primeiro Deploy

### Fluxo Automático do Entrypoint

O `entrypoint.sh` do backend executa automaticamente:

1. ✅ Valida variáveis obrigatórias (`DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`)
2. ⏳ Aguarda o PostgreSQL ficar disponível (extrai host/porta do `DATABASE_URL`)
3. 📦 Roda `prisma@6 migrate deploy` (aplica migrações)
4. 🌱 Executa seed se `SEED_ON_STARTUP=true` e banco está vazio
5. 🚀 Inicia `node dist/main.js`

### Credenciais do Seed

O seed cria automaticamente:

| Usuário | Email | Senha |
|:---|:---|:---|
| Admin | `admin@kszap.com` | `Admin@123` |
| Supervisor | `supervisor@kszap.com` | `Admin@123` |
| Atendente | `atendente@kszap.com` | `Admin@123` |

> [!CAUTION]
> Após o primeiro deploy, altere `SEED_ON_STARTUP` para `false` e **troque as senhas** imediatamente.

---

## 🔍 Verificação do Deploy

### Health Check

```
GET https://seu-backend.railway.app/health
```

Resposta esperada:
```json
{ "status": "ok", "timestamp": "2026-02-26T..." }
```

### Logs do Railway

No painel do serviço → **"Logs"**, você verá:
```
==========================================
🚀 MultiAtendimento - Railway Entrypoint
==========================================
🔍 Validando variáveis de ambiente...
✅ DATABASE_URL configurada
✅ JWT_SECRET configurada
✅ ENCRYPTION_KEY configurada
⏳ Aguardando banco de dados...
✅ Banco de dados disponível
📦 Executando migrações do Prisma...
✅ Migrações aplicadas com sucesso
🌱 Executando seed (banco vazio detectado)...
✅ Seed concluído com sucesso
🚀 Iniciando aplicação...
```

---

## 🐛 Troubleshooting

### "Banco de dados não respondeu"

O entrypoint tenta conectar por 60 segundos. Se falhar, ele prossegue mesmo assim (a aplicação pode reconectar). Isso pode acontecer no primeiro deploy enquanto o PostgreSQL ainda está provisionando.

**Solução**: Redeploy o serviço após o PostgreSQL estar ativo.

### "migrate deploy falhou"

O entrypoint automaticamente faz fallback para `db push` se as migrações falharem. Isso é seguro para o primeiro deploy. Para deploys subsequentes, verifique se há migrações pendentes no repositório.

### "CORS bloqueado"

**Solução**: Configure `CORS_ORIGIN` com a URL exata do frontend:
```
CORS_ORIGIN=https://seu-frontend.railway.app
```

### "Variáveis NEXT_PUBLIC não funcionam"

Variáveis `NEXT_PUBLIC_*` são embutidas no build. Após alterar:
1. Vá ao serviço Frontend no Railway
2. Clique **"Redeploy"** (não apenas restart)

---

## 🔐 Segurança em Produção

- ✅ HTTPS automático pelo Railway (SSL/TLS grátis)
- ✅ Execução como usuário não-root no container
- ✅ Healthcheck configurado no Docker
- ✅ Validação obrigatória de chaves fortes no entrypoint
- ⚠️ Altere as senhas padrão do seed imediatamente
- ⚠️ Configure `CORS_ORIGIN` para aceitar apenas seu domínio

---

## 🔄 Atualizações Futuras

O Railway faz deploy automático em cada push no branch principal.

### Rollback
1. Railway → **Deployments**
2. Selecione uma versão anterior
3. Clique **"Redeploy"**

---

## 💰 Estimativa de Custos

| Serviço | Custo Estimado |
|:---|:---|
| Backend | ~$5/mês |
| Frontend | ~$5/mês |
| PostgreSQL | ~$5/mês |
| Redis | ~$5/mês |
| **Total** | **~$20/mês** |

---

## 📞 Suporte

- [Documentação Railway](https://docs.railway.app)
- [GitHub Issues](https://github.com/jeanlrv/multiatendimento-app/issues)

---

*Última atualização: 26/02/2026*