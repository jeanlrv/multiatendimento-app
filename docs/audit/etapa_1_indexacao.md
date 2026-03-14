# Auditoria Técnica - Etapa 1: Indexação e Compreensão

## Visão Geral da Arquitetura
O sistema **KSZap** é uma plataforma SaaS multi-tenancy para atendimento via WhatsApp, integrada com Inteligência Artificial. A arquitetura segue um modelo de monolito modularizado no backend e um frontend moderno baseado em Next.js.

- **Backend**: Desenvolvido com **NestJS**, focado em escalabilidade e modularização. Utiliza **Prisma ORM** para persistência em PostgreSQL (com pgvector) e **BullMQ** (Redis) para processamento de tarefas em segundo plano (webhooks, processamento de IA, disparos).
- **Frontend**: Desenvolvido com **Next.js 14**, utilizando o App Router. A interface é rica em componentes (Radix UI) e interações em tempo real via **Socket.io**.
- **IA/RAG**: Sistema robusto de Retrieval-Augmented Generation (RAG) utilizando LangChain, com suporte a múltiplos provedores de embedding e modelos (OpenAI, Anthropic, Google, Ollama, ONNX nativo).
- **Integração WhatsApp**: Utiliza a API da **Z-API** como gateway de comunicação.

## Responsabilidades dos Módulos

### Backend (`/backend/src/modules`)
- **`auth`**: Gestão de autenticação (JWT) e autorização (RBAC).
- **`companies`**: Gestão de tenants (empresas), limites e branding.
- **`tickets`**: Motor principal de atendimento e orquestração de mensagens.
- **`whatsapp`**: Integração com instâncias Z-API e tratamento de webhooks.
- **`ai` / `vector-store`**: Hub de IA, geração de embeddings e busca em base de conhecimento.
- **`workflows`**: Motor de automação baseado em regras e grafos.
- **`contacts`**: CRM e gestão de base de clientes.

### Frontend (`/frontend/src/app`)
- **`/dashboard`**: Interface central para usuários e administradores.
- **`/chat`**: Interface de conversação em tempo real.
- **`/ai-hub`**: Gestão de agentes e bases de conhecimento.
- **`/workflows`**: Builder visual de automações.

## Dependências Importantes
- **Linguagens**: TypeScript (Full Stack), Python (para embeddings locais).
- **Frameworks**: NestJS, Next.js, Prisma, BullMQ, LangChain, Tailwind CSS.
- **Infraestrutura**: PostgreSQL, Redis, S3 (AWS SDK), Nginx.
- **Serviços Externos**: Z-API (WhatsApp), Provedores de LLM (OpenAI, etc.).

## Fluxo Principal do Sistema
1. **Entrada**: Webhook da Z-API recebe mensagem do WhatsApp.
2. **Processamento**: Backend valida a empresa, localiza ou cria o ticket.
3. **Lógica de IA**: Se o modo for `AI` ou `HIBRIDO`, o agente de IA processa a mensagem via LangChain/RAG.
4. **Resposta**: Mensagem é enviada de volta pela Z-API e transmitida via Socket.io para o Dashboard do atendente.
5. **Automação**: Gatilhos de Workflow podem ser disparados baseados no conteúdo ou sentimento da mensagem.

## Pontos Frágeis Identificados
- **Esquema de Banco de Dados**: O arquivo `schema.prisma` é extremamente extenso, o que pode dificultar a manutenção e indicar acoplamento excessivo na camada de dados.
- **Dependência de Z-API**: O sistema é fortemente dependente de um provedor de gateway específico.
- **Complexidade de Workflows**: A lógica de grafos e estados JSON pode se tornar difícil de depurar sem ferramentas de observabilidade robustas.
- **Tratamento de Erros de IA**: Fallbacks de embeddings e modelos de IA precisam de monitoramento constante para evitar degradação da experiência do usuário.
