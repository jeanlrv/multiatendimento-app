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
*   **Workflows (Smart Flow V2)**: Motor de grafos (nós e arestas) para automação de processos via BullMQ.
*   **AI Service**: Integração com AnythingLLM. Oferece análise de sentimento, transcrição de áudio, resumo de conversas e detecção de intenção.
*   **Scheduling**: Sistema de filas para tarefas agendadas no futuro.

### [Frontend]
*   **Automações (`/dashboard/workflows`)**: Builder visual de fluxos.
*   **Agentes de IA (`/dashboard/ai-agents`)**: Configuração de personas e prompts.

---

## 📈 4. Inteligência e Auditoria

### [Módulos Backend]
*   **Dashboard**: Agregação de métricas (satisfação, volume, tempo de resposta).
*   **Reports**: Geração de relatórios executivos diários via e-mail.
*   **Evaluations**: Gestão de CSAT e análise sentimental automática.

### [Frontend]
*   **Painel Principal (`/dashboard/page.tsx`)**: Widgets e gráficos de performance.
*   **Intelligence HUB (`/dashboard/reports`)**: Acesso a métricas consolidadas.

---

## 🛠️ 5. Infraestrutura

*   **Mail**: Serviço de e-mail via SMTP configurável.
*   **Notifications**: Sistema de alertas internos (Push/In-app).
*   **Uploads**: Gestão de arquivos e mídias recebidas.
*   **Prisma/DB**: Estrutura relacional no PostgreSQL com Redis para cache.

---

## 🚀 Próximas Melhorias Sugeridas (Roadmap VIP)

1.  **Workflows Externos**: Adicionar nós que disparam Webhooks para sistemas de terceiros (ex: Bling, RD Station).
2.  **RAG Dinâmico**: Upload de documentos por departamento para treinamento imediato da IA.
3.  **App Mobile Nativo**: Interface simplificada para atendentes via PWA ou React Native.
4.  **Dashboard em Tempo Real**: Transformar os contadores do Dashboard em observáveis via Socket.IO.
