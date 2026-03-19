# KSZap Aero – Product Requirements Document (PRD) 

## 1. Visão Geral

O KSZap Aero é uma plataforma SaaS multiempresa para gestão de atendimentos, agenda, contatos e workflows inteligentes, agora potencializada por um Hub de IA de última geração.

O sistema é estruturado para:

- Multiempresa (Tenant-based architecture)
- Controle de acesso por papéis (RBAC) e segurança robusta (Helmet, JWT rotating)
- Escalabilidade horizontal e Deploy Automatizado
- Experiência CRM moderna com IA preditiva (Mini-CRM Customers)
- Hub de IA Multimodal (Texto e Visão)
- Broadcast e Mensagens Agendadas integradas ao CRM
- CSAT / Avaliações para controle de Qualidade
- Embed Widget para integração em sites externos
- Respostas Rápidas (Macros)
- Interface Liquid Glass com Dark Mode nativo

---

## 2. Objetivos do Produto

- Permitir que múltiplas empresas utilizem a plataforma de forma isolada (Multi-tenancy).
- Fornecer CRM completo de contatos com métricas de risco.
- Automação inteligente via Workflows baseados em grafos.
- Atendimento híbrido (Humano + IA) com análise de sentimento e transcrição.
- Notificações em tempo real para eventos críticos e processos de background.
- Atendimento pró-ativo via Broadcast e Mensagens Agendadas.
- Coleta de métricas e Qualidade via CSAT.
- Gestão de custos de IA através de limites granulares por empresa.

---

## 3. Arquitetura Multiempresa

Cada dado pertence obrigatoriamente a uma empresa (`companyId`).

Regras:
- Isolamento total de banco de dados por `companyId`.
- JWT carrega `companyId` e `role`.
- Mapeamento avançado de segurança: `httpOnly` cookies persistentes para tokens, `AES-256-GCM` para credenciais (`SMTPPassword`, `ZApiTokens`), limitadores de taxa globais, validação JWT com rotatividade.
- Módulos auditados: Contacts, Customers (Mini-CRM), Tickets, Users, Workflows, Quick Replies, AI Hub, Dashboard, Settings, Embed Widget, Broadcast.

---

## 4. Módulo de Contatos (CRM)

- Cadastro, busca e segmentação avançada.
- Risk Score (0-100): Avalia comportamento e feedbacks.
- Gestão de campos personalizados e histórico dinâmico.
- Importação/Exportação CSV e sincronização via API.

---

## 5. Motor de Workflows (Smart Flow V2)

- Builder visual de nós e arestas com suporte a lógica condicional.
- Gatilhos: Mensagem Recebida, Mudança de Status, Eventos Manuais, Webhooks.
- Ações: Envio de mídia, Transferência, Delays, IA Intent, Notificações Push.
- Versionamento com rollback e Simulação em tempo real.

---

## 6. Inteligência Artificial (AI Hub Nativo)

O sistema evoluiu para um hub nativo de IA (LangChain), eliminando dependências externas:

- **RAG Avançado**: Base de conhecimento com suporte a PDF, DOCX e URLs. Armazenamento híbrido (Local/S3) e sistema de cache de embeddings.
- **Vision (Multimodal)**: Capacidade de analisar e descrever imagens enviadas via chat (GPT-4o/Gemini).
- **Playground**: Ambiente de teste para agentes com histórico de conversas persistente.
- **Sentiment & Transcription**: Análise de sentimento em tempo real e conversão de áudio em texto.
- **Dashboards de IA**: Monitoramento de tokens consumidos por empresa, agente e modelo em tempo real.
- **AI Rate Limiting**: Limites de segurança (tokens/hora, tokens/dia) configuráveis por tenant.

### 6.1 Embeddings (RAG)

O sistema suporta múltiplos providers de embedding, com fallback automático para garantir alta disponibilidade:

| Provider | Descrição | Custo | Uso Recomendado |
|----------|-----------|-------|-----------------|
| **Python Embed** | Embedding local via Python + sentence-transformers (paraphrase-MiniLM-L6-v2) | 🆓 Free |.defaults, Railway, Docker self-hosted |
| **Native (ONNX)** | Embedding via @xenova/transformers (Xenova/bge-micro-v2) | 🆓 Free | Ambientes com suporte a WASM |
| **OpenAI** | Embedding via API OpenAI (text-embedding-3-small, 3 dimensions) | 💰 Baixo | Produção com alta performance |
| **Ollama** | Embedding local via Ollama (nomic-embed-text) | 🆓 Free | Development/local |

**Configuração por Base de Conhecimento ou Agente:**
- `embeddingProvider`: `'python-embed'` | `'native'` | `'openai'` | `'ollama'`
- `embeddingModel`: Modelo específico do provider (ex: `paraphrase-MiniLM-L6-v2`)

**Fallback Automático (ordem):**
1. Provider primário configurado
2. Fallback para provider alternativo (ex: native → python-embed)
3. Fallback para OpenAI (se API key configurada)
4. Documento salvo sem vetorização (apenas busca full-text)

**Embeddings por Provider:**
- `python-embed`: 384 dimensões (paraphrase-MiniLM-L6-v2)
- `native`: 384 dimensões (Xenova/bge-micro-v2)
- `openai`: 1536 dimensões (text-embedding-3-small)
- `ollama`: variável (nomic-embed-text: 768)

---

## 7. Roadmap de Evolução

- **Sprint 1 (Atual)**: Finalização do Hub de Notificações via WebSocket e Mobile Push.
- **Sprint 2**: IA Generativa para criação automática de fluxos de atendimento.
- **Sprint 3**: Integrações nativas com CRMs externos (Salesforce/Hubspot) via Webhooks BI.
- **Sprint 4**: Broadcast/Marketing em massa com IA para personalização de mensagens.
