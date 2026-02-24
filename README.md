# Plataforma Multi-WhatsApp com IA

<div align="center">
  <h3>🚀 Sistema SaaS Open-Source para Atendimento Multi-WhatsApp com IA</h3>
  <p>Integração com Z-API • AnythingLLM • Análise Sentimental • Sistema de Tickets</p>
</div>

---

## 📋 Sobre o Projeto

Plataforma completa e open-source para gerenciamento de atendimento via WhatsApp com múltiplas conexões, integração de IA para análise sentimental, sistema robusto de tickets, controle granular de permissões (RBAC) e dashboards analíticos.

### ✨ Principais Funcionalidades

- 📱 **Multi-WhatsApp**: Conecte múltiplos números via Z-API
- 🤖 **IA Integrada**: AnythingLLM para análise sentimental e sugestões
- 🎫 **Sistema de Tickets**: Gestão completa de atendimentos
- 👥 **Departamentos**: Organização por setores com SLA
- ⭐ **Avaliação Dual**: Cliente (opcional) + IA (obrigatória)
- 🔔 **Workflows Automáticos**: Alertas configuráveis por score sentimental
- 📊 **Dashboards**: Métricas e relatórios em tempo real
- 🔐 **RBAC Completo**: Controle granular de permissões
- 📝 **Auditoria**: Logs imutáveis de todas as ações
- 🌙 **Dark Mode**: Interface moderna e responsiva

---

## 🏗️ Stack Tecnológica

### Frontend
- **Next.js 14** (App Router)
- **TailwindCSS** + **ShadCN UI**
- **WebSocket** para tempo real
- **TypeScript**

### Backend
- **NestJS** (Node.js)
- **Prisma ORM**
- **PostgreSQL**
- **Redis** (cache e filas)
- **Swagger** (documentação API)
- **WebSocket** (Socket.io)

### Infraestrutura
- **Docker** + **Docker Compose**
- **Nginx** (reverse proxy)

### Integrações
- **Z-API** (WhatsApp)
- **AnythingLLM** (IA - self-hosted)
- **SMTP** (emails)

---

## 🚀 Instalação

### Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- Git

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/whatsapp-saas.git
cd whatsapp-saas
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações.

### 3. Inicie com Docker

```bash
docker-compose up -d
```

### 4. Acesse a aplicação

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Swagger Docs**: http://localhost:3001/api

### 5. Credenciais padrão

- **Email**: admin@whatsapp-saas.com
- **Senha**: Admin@123

⚠️ **Importante**: Altere a senha padrão após o primeiro login!

---

## 📦 Instalação Manual (sem Docker)

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔧 Configuração

### Z-API

1. Crie uma conta em [Z-API](https://www.z-api.io/)
2. Obtenha o `instanceId` e `token`
3. Configure no painel admin em **Configurações > Conexões WhatsApp**

### AnythingLLM

1. Instale o [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm)
2. Configure a URL e API Key no `.env`
3. Crie workspaces para cada departamento

### SMTP

Configure no painel admin em **Configurações > Email**

---

## 📚 Documentação

- [Guia de Início Rápido](./docs/INICIO_RAPIDO.md)
- [Manual do Usuário (Atendentes & Admins)](./docs/manual_usuario.md)
- [Correção de Erros Comuns](./docs/CORRECAO_ERROS.md)
- [Configuração do Projeto](./docs/PROJETO_CONFIGURADO.md)
- [API Documentation](http://localhost:3001/api/docs)

---

## 🎯 Roadmap

- [x] Sistema de autenticação e RBAC
- [x] Integração Z-API (Multi-instâncias)
- [x] Sistema de tickets e CRM com Risk Score
- [x] Análise sentimental e transcrição com IA
- [x] Motor de Workflows Robusto (V2)
- [ ] Integração com Webhooks Externos
- [ ] App mobile PWA
- [ ] Dashboard em Tempo Real

---

## 📚 Documentação Atualizada

- [**Mapa do Sistema**](./MAPA_DO_SISTEMA.md) - Guia completo de módulos e funções.
- [Especificações Técnicas (SPECS)](./SPECS.md) - Arquitetura e Stack.
- [Product Requirements (PRD)](./PRD.md) - Visão de produto e Roadmap.
- [Manual do Usuário](./docs/manual_usuario.md)
- [Guia de Início Rápido](./docs/INICIO_RAPIDO.md)

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 💬 Suporte

- 📧 Email: suporte@whatsapp-saas.com
- 💬 Discord: [Link do servidor]

---

## 🙏 Agradecimentos

- [Z-API](https://www.z-api.io/) - Integração WhatsApp
- [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) - IA
- [NestJS](https://nestjs.com/) - Framework backend
- [Next.js](https://nextjs.org/) - Framework frontend
- [ShadCN UI](https://ui.shadcn.com/) - Componentes UI

---

<div align="center">
  Feito com ❤️ pela comunidade open-source
</div>
