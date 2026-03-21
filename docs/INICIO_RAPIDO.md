# 🚀 Guia de Início Rápido - WhatsApp SaaS

## ✅ Projeto Configurado

A estrutura completa da plataforma multi-WhatsApp com IA foi criada com sucesso!

---

## 📁 Estrutura do Projeto

```
multiatendimento-app/
├── backend/           # API NestJS + Prisma
├── frontend/          # Next.js 14 + TailwindCSS
├── nginx/             # Reverse Proxy
├── docker-compose.yml # Orquestração
├── .env.example       # Variáveis de ambiente
└── README.md          # Documentação completa
```

---

## 🚀 Como Iniciar

### 1️⃣ Configure as Variáveis de Ambiente

```bash
# Copie o arquivo de exemplo
copy .env.example .env

# Edite o .env com suas configurações
# (JWT_SECRET, credenciais do banco, etc.)
```

### 2️⃣ Inicie os Containers Docker

```bash
# Inicie todos os serviços
docker-compose up -d

# Aguarde os containers iniciarem
# PostgreSQL, Redis, Backend, Frontend e Nginx
```

### 3️⃣ Execute as Migrations e Seed

```bash
# Entre no container do backend
docker exec -it whatsapp-backend sh

# Execute as migrations do Prisma (USE SEMPRE @6)
npx prisma@6 migrate dev --name init

# Popule o banco com dados iniciais
npm run seed

# Saia do container
exit
```

### 4️⃣ Acesse a Aplicação

- **Frontend**: http://localhost:3000
- **API Backend**: http://localhost:3001/api
- **Documentação Swagger**: http://localhost:3001/api/docs

---

## 🔑 Credenciais Padrão

Após executar o seed, use estas credenciais para login:

| Perfil | Email | Senha |
|--------|-------|-------|
| **Administrador** | admin@whatsapp-saas.com | Admin@123 |
| **Supervisor** | supervisor@whatsapp-saas.com | Admin@123 |
| **Atendente** | atendente@whatsapp-saas.com | Admin@123 |

> ⚠️ **Importante**: Altere as senhas após o primeiro login!

---

## 📦 Dados Iniciais (Seed)

O seed cria automaticamente:

- ✅ **4 Perfis de Acesso** (Roles): Admin, Supervisor, Atendente, Auditor
- ✅ **3 Usuários** com diferentes perfis
- ✅ **2 Departamentos**: Suporte e Vendas
- ✅ **1 Agente de IA**: Assistente Geral
- ✅ **5 Tags**: Urgente, Bug, Dúvida, Sugestão, Reclamação
- ✅ **Feature Flags**: Todas as configurações padrão
- ✅ **1 Workflow**: Alerta de sentimento negativo

---

## 🛠️ Comandos Úteis

### Docker

```bash
# Iniciar todos os serviços
docker-compose up -d

# Parar todos os serviços
docker-compose down

# Ver logs
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f backend

# Reconstruir containers
docker-compose up -d --build
```

### Backend

```bash
# Entrar no container
docker exec -it whatsapp-backend sh

# Gerar Prisma Client (USE SEMPRE @6)
npx prisma@6 generate

# Criar migration (USE SEMPRE @6)
npx prisma@6 migrate dev --name nome_da_migration

# Abrir Prisma Studio (USE SEMPRE @6)
npx prisma@6 studio

# Executar seed
npm run seed
```

### Frontend

```bash
# Entrar no container
docker exec -it whatsapp-frontend sh

# Instalar dependências
npm install

# Iniciar em modo dev
npm run dev
```

---

## 🎯 Próximos Passos

### Fase 3: Implementar Autenticação

1. Criar módulo de autenticação no backend
2. Implementar login com JWT
3. Criar guards de permissão (RBAC)
4. Desenvolver tela de login no frontend

### Fase 4: Módulo WhatsApp

1. Integrar com Z-API
2. Criar sistema de webhooks
3. Implementar envio de mensagens
4. Gerenciar múltiplas conexões

### Fase 5: Sistema de Tickets

1. CRUD de tickets
2. Atribuição automática
3. Interface de chat em tempo real
4. Sistema de tags

---

## 🔧 Configurações Importantes

### Threshold de Workflow

O sistema possui um parâmetro configurável que define quando disparar alertas:

- **Chave**: `workflow.sentiment_threshold_score`
- **Padrão**: 7 (escala 0-10)
- **Função**: Quando a análise sentimental da IA for menor que este valor, dispara workflow de alerta

Você pode alterar este valor no painel de configurações após fazer login.

### Avaliação Dual

O sistema possui dois tipos de avaliação:

1. **Avaliação do Cliente** (opcional)
   - Nota de 0 a 10
   - Feedback textual

2. **Análise Sentimental da IA** (obrigatória)
   - Score de 0 a 10
   - Classificação: POSITIVE, NEUTRAL, NEGATIVE
   - Resumo e justificativa automáticos

---

## 📚 Documentação Completa

- **README.md**: Documentação principal do projeto
- **Swagger**: http://localhost:3001/api/docs (após iniciar)
- **Prisma Schema**: `backend/prisma/schema.prisma`

---

## ⚠️ Troubleshooting

### Porta já em uso

Se alguma porta estiver em uso, edite o `docker-compose.yml`:

```yaml
# Exemplo: mudar porta do frontend de 3000 para 3002
frontend:
  ports:
    - "3002:3000"  # host:container
```

### Erro ao conectar no banco

Verifique se o PostgreSQL iniciou corretamente:

```bash
docker-compose logs postgres
```

### Prisma não gera os tipos

> [!WARNING]
> Nunca use o comando sem a tag `@6`. O uso da v7 causará erro P1012.

```bash
docker exec -it whatsapp-backend sh
npx prisma@6 generate
```

---

## 🎉 Pronto!

Seu ambiente está configurado e pronto para desenvolvimento!

**Recomendação**: Comece implementando o módulo de autenticação (Fase 3) para ter um sistema funcional de login.

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Consulte o README.md principal
2. Verifique a documentação da API no Swagger
3. Revise os logs com `docker-compose logs -f`
