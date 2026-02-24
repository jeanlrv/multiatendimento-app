# Especificações Técnicas (SPECS) - KSZap

## 1. Visão Geral da Arquitetura

O KSZap utiliza uma arquitetura moderna baseada em microsserviços lógicos (Modular Monolith) no backend e uma Single Page Application (SPA) no frontend, ambos contêinerizados via Docker.

### 1.1 Diagrama de Stack
*   **Frontend:** Next.js 14 (React), Tailwind CSS, Framer Motion, Zustand.
*   **Backend:** NestJS (Node.js), Socket.IO, Prisma ORM.
*   **Filas/Jobs:** BullMQ + Redis (Processamento de Workflows e Agendamentos).
*   **IA:** AnythingLLM (Vector DB) + Agentes Customizados.

---

## 2. Estrutura de Diretórios

### 2.1 Backend (`/backend`)
Seguimos o padrão **Modular Monolith**:
- `auth`: Segurança e Tenant Isolation.
- `chat`: Real-time gateway.
- `workflows`: Motor de automação funcional.
- `ai`: Serviços de NLP e Transcrição.
- `tickets`: Orquestração de atendimento.
- `contacts`: CRM e Risk Scoring.

---

## 3. Segurança e Multi-tenancy

O sistema utiliza um **Tenant Guard** global que exige a presença de `companyId` em todas as requisições autenticadas.
- **Isolamento de Dados**: Todas as tabelas possuem índice em `companyId`.
- **RBAC**: Permissões granulares armazenadas no Banco de Dados por Role.

---

## 4. Workflows e Jobs

As automações são processadas de forma assíncrona para garantir a estabilidade do chat:
1. **Trigger**: O evento (ex: mensagem recebida) entra na fila `workflows`.
2. **Processor**: O BullMQ consome o job e executa o grafo de nós.
3. **Actions**: Resultados são persistidos e notificações enviadas via Socket.IO.

## 2.2 Frontend (`/frontend`)
App Router do Next.js:
```
src/
├── app/                 # Rotas e Layouts (Pages)
│   ├── dashboard/       # Área logada
│   └── (auth)/          # Login/Recuperação
├── components/          # Componentes Reutilizáveis (UI)
├── contexts/            # Context API (AuthContext)
├── hooks/               # Custom Hooks (useTickets, useAudio)
├── services/            # Camada de API (Axios instances)
└── styles/              # Configurações globais Tailwind
```

## 3. Modelo de Dados (Schema Principal)

Entidades chave do `schema.prisma`:

*   **User:** Usuários do sistema (Atendentes/Admins).
*   **Department:** Setores da empresa. Possui configurações de bot (mensagens, IA).
*   **WhatsAppConnection:** Sessões do WhatsApp vinculadas à Z-API.
*   **Contact:** Clientes finais.
*   **Ticket:** Sessão de atendimento. Possui status (`OPEN`, `PENDING`, `CLOSED`).
*   **Message:** Log de mensagens trocadas.
*   **Evaluation:** Feedback e análise de sentimento da IA.
*   **WorkflowRule:** Definição de grafos (JSON Nodes/Edges) para automação.
*   **WorkflowExecution:** Histórico de steps e logs de execução.

## 4. Interfaces de Comunicação

### 4.1 API REST
*   Padrão: `GET/POST/PATCH/DELETE` em `/api/resource`.
*   Autenticação: Bearer Token (JWT) no Header `Authorization`.
*   Uploads: `multipart/form-data` em `/api/uploads`.

### 4.2 WebSocket (Real-time)
*   Namespace: `/` (Default).
*   Eventos Principais:
    *   `ticket.created`: Novo chamado na fila.
    *   `ticket.updated`: Mudança de status/atribuição.
    *   `message.created`: Nova mensagem no chat (update imediato).
    *   `app.status`: Status das conexões WhatsApp.

## 5. Integrações Específicas

### 5.1 Z-API (WhatsApp)
*   **Webhook:** O sistema expõe `/api/whatsapp/webhook` para receber eventos.
*   **Segurança:** Validação do token de segurança da instância.
*   **Media:** Download automático de mídias recebidas para `./public/uploads`.

### 5.2 IA (AnythingLLM/OpenAI)
*   **RAG:** O sistema consulta a base vetorial do AnythingLLM para respostas automáticas.
*   **Transcrições:** Áudios são enviados para conversão Speech-to-Text.

## 6. Variáveis de Ambiente (.env)

| Variável | Descrição |
| :--- | :--- |
| `DATABASE_URL` | Connection string do PostgreSQL |
| `REDIS_URL` | Connection string do Redis |
| `JWT_SECRET` | Chave de assinatura dos tokens |
| `ZAPI_BASE_URL` | URL da API oficial ou Proxy Z-API |
| `NEXT_PUBLIC_API_URL` | URL do Backend acessível pelo Frontend |

## 7. Diretrizes de Desenvolvimento (Antigravity Standard)

1.  **Zero `any`:** Uso estrito de tipagem TypeScript.
2.  **Linting Rigoroso:** Nenhum erro de ESLint permitido no commit.
3.  **Atomic Commits:** Commits pequenos e descritivos.
4.  **Error Handling:** Tratamento global de exceções (HttpExceptionFilter).
5.  **Clean Architecture:** Separação clara de responsabilidades (Controller -> Service -> Repository/Prisma).
