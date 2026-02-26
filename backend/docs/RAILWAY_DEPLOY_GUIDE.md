# 🚀 Guia de Deploy para Railway

Este guia completo explica como deployar o MultiAtendimento no Railway.com com configuração otimizada.

---

## 📋 Pré-requisitos

1. Conta no [Railway](https://railway.app)
2. Repositório Git público ou privado com o código do projeto
3. Conhecimento básico de terminal

---

## 🏗️ Arquitetura Recomendada

```
┌─────────────────────────────────────────────────────────────┐
│                      Railway Platform                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Backend    │  │   Frontend   │  │    Nginx     │      │
│  │   (Node.js)  │  │  (Next.js)   │  │   (Proxy)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│  ┌──────▼─────────────────▼─────────────────▼───────┐      │
│  │              PostgreSQL (Database)                │      │
│  └───────────────────────────────────────────────────┘      │
│  ┌───────────────────────────────────────────────────┐      │
│  │                   Redis (Optional)                 │      │
│  │              (Workflows & Queues)                  │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Passo a Passo do Deploy

### 1. Preparar o Repositório

```bash
# Certifique-se de que todas as alterações estão commitadas
git add .
git commit -m "Otimização para deploy Railway"
git push origin main
```

### 2. Criar Novo Projeto no Railway

1. Acesse [railway.app](https://railway.app)
2. Clique em **"New Project"**
3. Selecione **"Deploy from a Git repository"**
4. Escolha seu repositório (GitHub/GitLab/Bitbucket)

### 3. Adicionar Serviços

#### A. PostgreSQL (Database)

1. No seu projeto Railway, clique em **"+ New"**
2. Selecione **"PostgreSQL"**
3. O Railway fornecerá automaticamente a variável `DATABASE_URL`

#### B. Redis (Opcional - para Workflows)

1. Clique em **"+ New"**
2. Selecione **"Redis"**
3. O Railway fornecerá automaticamente a variável `REDIS_URL`

#### C. Backend Service

1. Clique em **"+ New"**
2. Selecione **"Deploy from Git"**
3. Escolha seu repositório
4. Selecione o **backend** como root directory

#### D. Frontend Service

1. Clique em **"+ New"**
2. Selecione **"Deploy from Git"**
3. Escolha seu repositório
4. Selecione o **frontend** como root directory

---

## ⚙️ Configuração de Variáveis de Ambiente

### Backend Variables

No painel do serviço Backend, adicione as seguintes variáveis:

| Variável | Obrigatório | Valor | Descrição |
|----------|-------------|-------|-----------|
| `DATABASE_URL` | ✅ | Automático | Fornecido pelo PostgreSQL addon |
| `JWT_SECRET` | ✅ | Gerado | Chave JWT (32+ caracteres) |
| `JWT_REFRESH_SECRET` | ✅ | Gerado | Chave refresh JWT (32+ caracteres) |
| `ENCRYPTION_KEY` | ✅ | Gerado | Chave criptografia (32+ caracteres) |
| `REDIS_URL` | ⚠️ | Automático | Fornecido pelo Redis addon (opcional) |
| `NODE_ENV` | ⚠️ | `production` | Ambiente de produção |
| `PORT` | ⚠️ | `3000` | Porta da aplicação |
| `SEED_ON_STARTUP` | ⚠️ | `true` | Executar seed no primeiro deploy |

### Gerar Chaves Seguras

Execute no terminal:

```bash
# Gerar JWT_SECRET
openssl rand -base64 32

# Gerar JWT_REFRESH_SECRET
openssl rand -base64 32

# Gerar ENCRYPTION_KEY
openssl rand -base64 32
```

### Frontend Variables

No painel do serviço Frontend, adicione:

| Variável | Obrigatório | Valor | Descrição |
|----------|-------------|-------|-----------|
| `NEXT_PUBLIC_API_URL` | ✅ | `https://seu-backend.railway.app` | URL da API backend |
| `NEXT_PUBLIC_WS_URL` | ✅ | `wss://seu-backend.railway.app` | URL WebSocket |

---

## 🔧 Configuração Avançada

### 1. Configurar Redis para Workflows

Se você deseja usar Workflows avançados:

1. Adicione o addon Redis no Railway
2. Adicione a variável `REDIS_URL` no serviço Backend
3. O sistema usará Redis automaticamente para:
   - Workflows com espera de eventos
   - Filas de processamento
   - Rate limiting distribuído

### 2. Configurar Storage S3 (Opcional)

Para armazenamento de documentos da base de conhecimento:

```bash
# Variáveis opcionais
AWS_ACCESS_KEY_ID="sua-key"
AWS_SECRET_ACCESS_KEY="sua-secret"
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="seu-bucket"
```

### 3. Configurar SMTP para Emails

Configure via painel de configurações do sistema após deploy:

1. Acesse o sistema
2. Vá em **Configurações → Email**
3. Configure seu servidor SMTP

---

## 🚀 Primeiro Deploy

### 1. Habilitar Seed (Primeira Vez)

No serviço Backend, defina:

```
SEED_ON_STARTUP=true
```

Isso criará:
- Empresa padrão "KSZap Oficial"
- Usuários admin, supervisor, atendente
- Departamentos Suporte e Vendas
- Workflows padrão
- Tags e configurações iniciais

**Usuários padrão:**
- `admin@kszap.com` / `Admin@123`
- `supervisor@kszap.com` / `Admin@123`
- `atendente@kszap.com` / `Admin@123`

### 2. Desabilitar Seed (Após Primeira Vez)

Após o primeiro deploy bem-sucedido:

```
SEED_ON_STARTUP=false
```

Isso evita que dados sejam recriados em cada deploy.

---

## 🔍 Verificação do Deploy

### Health Check

Acesse: `https://seu-backend.railway.app/health`

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2026-02-26T14:30:00.000Z"
}
```

### Logs

No painel Railway, acesse **"Logs"** para ver:
- Inicialização do entrypoint
- Migrações do Prisma
- Execução do seed (se habilitado)
- Início da aplicação

---

## 🐛 Troubleshooting

### Problema: "DATABASE_URL não configurada"

**Solução:**
1. Verifique se o addon PostgreSQL foi adicionado
2. Verifique se a variável `DATABASE_URL` está presente no serviço Backend

### Problema: "JWT_SECRET não configurada"

**Solução:**
1. Gere uma chave segura: `openssl rand -base64 32`
2. Adicione como variável `JWT_SECRET` no serviço Backend

### Problema: "ENCRYPTION_KEY não configurada"

**Solução:**
1. Gere uma chave segura: `openssl rand -base64 32`
2. Adicione como variável `ENCRYPTION_KEY` no serviço Backend

### Problema: "Seed não executa"

**Solução:**
1. Verifique se `SEED_ON_STARTUP=true`
2. Verifique se o banco está vazio (sem usuários)
3. Verifique os logs do serviço Backend

### Problema: "Workflows não funcionam"

**Solução:**
1. Adicione o addon Redis no Railway
2. Adicione a variável `REDIS_URL` no serviço Backend
3. Reinicie o serviço Backend

---

## 📊 Monitoramento

### Métricas Disponíveis

- **Logs:** Painel Railway → Logs
- **Métricas:** Railway → Metrics (CPU, Memory, Requests)
- **Database:** Railway → PostgreSQL → Query Editor

### Configurar Alertas

1. Railway → Settings → Alerts
2. Configure notificações para:
   - Deploy failures
   - Service errors
   - Resource limits

---

## 🔐 Segurança

### Variáveis Sensíveis

NUNCA comite no Git:
- `.env` (com senhas reais)
- Chaves de API
- Tokens de autenticação

### HTTPS

O Railway fornece automaticamente:
- Certificados SSL/TLS
- Redirecionamento HTTP → HTTPS
- Headers de segurança

### Firewall

Configure no Railway:
- Permitir apenas IPs confiáveis (se necessário)
- Rate limiting para endpoints sensíveis

---

## 🔄 Atualizações

### Deploy Contínuo

O Railway faz deploy automático quando:
- Novo commit é pushado no branch principal
- Novo tag é criado

### Rollback

Se um deploy falhar:
1. Railway → Deployments
2. Selecione uma versão anterior
3. Clique em **"Redeploy"**

---

## 💰 Estimativa de Custos

### Plano Starter (Grátis)
- 500 horas/mês
- 512 MB RAM
- 2 GB storage

### Plano Professional
- $5/mês por serviço
- 2 GB RAM
- 25 GB storage

### Estimativa para Produção
- Backend: $5/mês
- Frontend: $5/mês
- PostgreSQL: $5/mês
- Redis: $5/mês
- **Total: ~$20/mês**

---

## 📞 Suporte

- [Documentação Railway](https://docs.railway.app)
- [GitHub Issues](https://github.com/jeanlrv/multiatendimento-app/issues)
- [Documentação do Sistema](./DOCUMENTACAO_SISTEMA.md)

---

*Última atualização: 26/02/2026*