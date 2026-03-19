# Especificações Técnicas (SPECS) - KSZap

## 1. Visão Geral da Arquitetura

O KSZap utiliza uma arquitetura baseada em **Modular Monolith** no backend e uma Single Page Application (SPA) no frontend, com foco em isolamento de tenants e processamento assíncrono.

### 1.1 Diagrama de Stack
*   **Frontend:** Next.js 14 (React), Tailwind CSS, Framer Motion, Zustand.
*   **Backend:** NestJS (Node.js), Socket.IO, Prisma ORM.
*   **Filas/Jobs:** BullMQ + Redis (Workflow, RAG Processing, Notifications).
*   **IA Hub:** LangChain + LLM Factory (OpenAI, Anthropic, Gemini, Groq, Mistral, Ollama).
*   **Vector DB:** PostgreSQL com extensão `pgvector`.
*   **Storage:** Híbrido (Local + AWS S3/Cloudflare R2).

---

## 2. Estrutura de Diretórios

### 2.1 Backend (`/backend`)
Seguimos o padrão **Modular Monolith** com forte isolamento por domínio:
- `auth`: Segurança e Tenant Isolation (JWT + RBAC).
- `chat`: Real-time gateway (Socket.IO).
- `workflows`: Motor de automação via grafos (Worker Nodes).
- `ai`: 
    - `engine`: LLM Provider Factory e Streaming logic.
    - `knowledge`: Processamento de documentos (PDF/DOCX) e Embeddings.
    - `notifications`: Feedback assíncrono de jobs via WebSockets.
    - `history`: Persistência de conversas do Playground.
- `tickets`: Orquestração de atendimento e SLA monitor.
- `contacts`: CRM, Bulk actions e Risk Scoring.

---

## 3. Segurança e Resiliência

O sistema implementa múltiplas camadas de proteção:
- **Tenant Guard**: Filtro global obrigatório por `companyId`.
- **SSRF Protection**: Validação de URLs em Workflows e RAG (bloqueio de IPs privados).
- **Entropia de Chaves**: Validação de força para `JWT_SECRET` e `ENCRYPTION_KEY` (mín. 32 chars).
- **SQLi Prevention**: Uso estrito de parâmetros em queries de similaridade vetorial.
- **AI Rate Limiting**: Limites configuráveis por tenant para evitar estouro de custos.

---

## 4. IA Hub & RAG Nativo

Diferente de sistemas baseados em APIs externas, o KSZap implementa um Hub nativo:
1. **LLM Factory**: Troca dinâmica de modelos (ex: GPT-4o para Vision, Groq para velocidade).
2. **Embedding Providers Múltiplos**: Suporte para Python, ONNX, OpenAI e Ollama com fallback automático.
3. **Async Processing**: Uploads de arquivos entram na fila BullMQ; o status é notificado via WebSocket quando concluído.
4. **Multimodal**: Processamento de `IMAGE` e `TEXT` integrado no mesmo pipeline de chat.

### 4.1 Providers de Embedding

O sistema suporta 4 providers de embedding com fallback automático:

| Provider | Caminho | Modelo Padrão | Dimensões | Custo |
|----------|---------|---------------|-----------|-------|
| **Python Embed** | `backend/embedding.py` | `paraphrase-MiniLM-L6-v2` | 384 | 🆓 Free |
| **Native** | `@xenova/transformers` via worker | `Xenova/bge-micro-v2` | 384 | 🆓 Free |
| **OpenAI** | API `text-embedding-3-small` | `text-embedding-3-small` | 1536 | ~$0.0001/1K |
| **Ollama** | Local `http://localhost:11434` | `nomic-embed-text` | 768 | 🆓 Free |

**Fallback Automático:**
1. Provider primário configurado no banco (via UI)
2. Se falhar, tenta fallback pré-configurado
3. Se OpenAI API key estiver configurada, usa fallback para OpenAI
4. Documento salvo sem vetorização (apenas FTS - Full Text Search)

**Integração com VectorStoreService:**
```typescript
// Exemplo de uso no VectorStoreService
const embeddings = await this.generateEmbeddingBatch(
    texts,
    'python-embed',  // ou 'native', 'openai', 'ollama'
    'paraphrase-MiniLM-L6-v2'
);
```

**Embeddings do Backend Embedding.py:**
- Script Python chamado via `child_process.execFile`
- Carrega modelo na primeira execução (cache em memória)
- Output: JSON `{ success: boolean, embedding: number[] }`
- Timeout: 60s por embedding

---

## 5. Modelo de Dados (Schema Principal)

Entidades chave do `schema.prisma`:
*   **Company**: Tenant principal com limites de uso (`limitTokens`).
*   **Customer / Contact**: Micro-CRM integrado.
*   **KnowledgeBase / Document**: RAG nativo e Embeddings.
*   **Broadcast / ScheduledMessage**: Eventos em massa e automações de disparo.
*   **ProviderConfig**: Múltiplos provedores e chaves geridas (S3, LLM).
*   **EmbedChatSession**: Chatbot headless para sites.
*   **APIKey**: Chaves de acesso persistentes para clientes da API.
*   **WorkflowRule**: Definição de grafos (JSON Nodes/Edges) para fluxos de chat.

---

## 6. Interfaces de Comunicação

### 6.1 API REST
*   Padrão: `GET/POST/PATCH/DELETE` em `/api/resource`.
*   Streaming: Suporte a `Server-Sent Events (SSE)` para respostas de IA.
*   Uploads: `multipart/form-data` gerenciado por Multer + Fast-Check.

### 6.2 WebSocket (Real-time)
*   Namespace: `/chat` (Autenticado).
*   Eventos Principais:
    - `notification.created`: Alertas de processamento concluído.
    - `ticket.updated`: Atualizações de status em tempo real.
    - `message.created`: Mensagens de chat (Humano/IA).

---

## 7. Infraestrutura e Deploy

### 7.1 Docker Multi-stage
O sistema utiliza uma imagem otimizada:
- **Build Stage**: Compilação TypeScript.
- **Runner Stage**: Imagem mínima (Node-Alpine) com Healthchecks.
- **Non-root User**: Segurança adicional no container.

### 7.2 Railway Automation
- **Entrypoint Script**: Garante a execução de `migrate deploy` e `seed` antes do start.
- **Service Discovery**: Integração nativa entre Backend, DB e Redis.

---

## 8. Variáveis de Ambiente (.env)

| Variável | Descrição |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL com pgvector |
| `ENCRYPTION_KEY` | Chave de 32 bytes para dados sensíveis |
| `JWT_SECRET` | Chave de assinatura para tokens de acesso |
| `JWT_REFRESH_SECRET` | Chave de assinatura para refresh tokens |
| `JWT_EXPIRATION` | Tempo de expiração em horas (ex: 24h) |
| `CORS_ORIGIN` | URL do frontend (proteção CORS) |
| `BACKEND_PUBLIC_URL` | URL do servidor (necessário p/ Webhooks) |
| `LLM_PROVIDER` | Provedor padrão (openai, gemini, anthropic, etc) |
| `S3_ENABLED` | Define se usa S3 para armazenamento de mídias |
| `REDIS_URL` | Redis para filas BullMQ |

---

## 9. Diretrizes (Antigravity Standard)
1. **Zero `any`**: Tipagem estrita não apenas na IA, mas em todos os Controllers e Services do Backend e Frontend via Interfaces e DTOs fortes.
2. **Modularidade**: Serviços e integrações Z-API/LLM Providers encapsulados.
3. **Audit First**: Toda ação de IA gera `AIUsage` log; toda exceção grave vai ao Sentry com sanitização de headers.

---

## 10. Cobertura de Testes
O projeto possui uma sólida cobertura composta por 14 suítes de testes unitários:
- Auth, TenantGuard e PermissionsGuard (RBAC).
- Chat Gateway (Sockets / Conexões Válidas) e Chat Service.
- Webhook Processing / Webhook Integration.
- Tickets Controller / Tickets Service.
- Servições de IA (AI Chat, AI Integration, Workflow Orchestrator).
- WhatsApp Service (Envio, Recepção, Fallbacks).
- CryptoService (Criptografia, Hashes, Tokens transparentes em Repouso).
