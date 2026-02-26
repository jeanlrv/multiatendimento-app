# Mapa do Sistema KSZap

Este documento fornece uma visão técnica e funcional completa de todos os módulos implementados no KSZap, servindo como base para manutenção e expansão.

---

## 🏗️ 1. Núcleo e Administração (Core)

### [Módulos Backend]
*   **Auth**: Autenticação via JWT, tratamento de Multi-tenancy (Empresas) e proteção de rotas.
*   **Users**: Gestão de usuários (Atendentes e Administradores). Scoped por `companyId`.
*   **Roles & Permissions**: Sistema RBAC granular. Permite criar perfis customizados ou usar o padrão `ADMIN`.
*   **Companies**: Configuração de cada tenant, incluindo cores de branding, logotipo e limites de tokens de IA.
*   **Audit**: Logger automático de ações críticas (quem alterou o quê e quando).

### [Frontend]
*   **Usuários (`/dashboard/users`)**: Tabela de gestão de equipe.
*   **Perfis (`/dashboard/roles`)**: Editor de permissões.
*   **Settings (`/dashboard/settings`)**: Branding e SMTP.

---

## 💬 2. Comunicação e CRM

### [Módulos Backend]
*   **WhatsApp**: Integração com Z-API, gestão de instâncias, QR Code e Webhooks.
*   **Tickets**: Motor de atendimento. Status: `ABERTO`, `EM PROGRESSO`, `WAITING`, `RESOLVED`.
*   **Chat**: Gateway real-time (Socket.IO) para mensagens, áudios e mídias.
*   **Contacts**: CRM com busca debounced e importação/exportação CSV.
*   **Tags**: Categorização visual de tickets e contatos.
*   **Collaboration**: Chat interno entre atendentes e rastreamento de presença online.

### [Frontend]
*   **Chat Central (`/dashboard/chat`)**: Interface principal de atendimento.
*   **Tickets (`/dashboard/tickets`)**: Gestão de fila e atribuição.
*   **CRM (`/dashboard/contacts`)**: Lista de clientes com Risk Score.

---

## ⚡ 3. Automação e Inteligência

### [Módulos Backend]
*   **Workflows (Smart Flow V2)**: Motor de grafos (nós e arestas) para automação de processos via BullMQ. Suporte a webhooks externos.
*   **AI Hub Nativo (LangChain)**: Substituiu AnythingLLM. Oferece RAG dinâmico (PDF/DOCX/URL), Visão Multimodal, análise de sentimento, transcrição e cache de embeddings.
*   **Conversation History**: Persistência de chats do Playground IA.
*   **Scheduling**: Sistema de filas para tarefas agendadas no futuro.

### [Frontend]
*   **Automações (`/dashboard/workflows`)**: Builder visual de fluxos.
*   **AI Hub (`/dashboard/ai-hub`)**: Gestão de Bases de Conhecimento, Agentes e Métricas de uso.
*   **Playground (`/dashboard/playground`)**: Teste de agentes em tempo real.

---

## 📈 4. Inteligência e Auditoria

### [Módulos Backend]
*   **Dashboard**: Agregação de métricas (satisfação, volume, tempo de resposta).
*   **AI Analytics**: Dashboard de consumo de tokens (Métricas por empresa/agente/modelo).
*   **Reports**: Geração de relatórios executivos diários via e-mail.
*   **Evaluations**: Gestão de CSAT e análise sentimental automática.

### [Frontend]
*   **Painel Principal (`/dashboard/page.tsx`)**: Widgets e gráficos de performance.
*   **Intelligence HUB (`/dashboard/reports`)**: Acesso a métricas consolidadas.

---

## 🛠️ 5. Infraestrutura

*   **Mail**: Serviço de e-mail via SMTP configurável.
*   **Notifications**: Sistema de alertas internos via WebSocket (EventEmitter2).
*   **Uploads**: Gestão híbrida de arquivos (S3 + Multer local).
*   **Prisma/DB**: Estrutura relacional no PostgreSQL com extensão pgvector e Redis para BullMQ.

---

## 🚀 Próximas Melhorias Sugeridas (Roadmap VIP)

1.  **Workflows Generativos**: Uso de IA para criar fluxos de automação a partir de texto.
2.  **App Mobile Nativo**: Interface simplificada para atendentes via PWA ou React Native.
3.  **Dashboards Customizáveis**: Widgets Drag & Drop para BI personalizado.
4.  **Omnicanal Avançado**: Integração direta com Instagram e Facebook Messenger API.
