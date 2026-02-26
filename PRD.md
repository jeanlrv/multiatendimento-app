# KSZap Aero – Product Requirements Document (PRD) 

## 1. Visão Geral

O KSZap Aero é uma plataforma SaaS multiempresa para gestão de atendimentos, agenda, contatos e workflows inteligentes, agora potencializada por um Hub de IA de última geração.

O sistema é estruturado para:

- Multiempresa (Tenant-based architecture)
- Controle de acesso por papéis (RBAC)
- Escalabilidade horizontal e Deploy Automatizado
- Experiência CRM moderna com IA preditiva
- Hub de IA Multimodal (Texto e Visão)
- Interface Liquid Glass com Dark Mode nativo

---

## 2. Objetivos do Produto

- Permitir que múltiplas empresas utilizem a plataforma de forma isolada (Multi-tenancy).
- Fornecer CRM completo de contatos com métricas de risco.
- Automação inteligente via Workflows baseados em grafos.
- Atendimento híbrido (Humano + IA) com análise de sentimento e transcrição.
- Notificações em tempo real para eventos críticos e processos de background.
- Gestão de custos de IA através de limites granulares por empresa.

---

## 3. Arquitetura Multiempresa

Cada dado pertence obrigatoriamente a uma empresa (`companyId`).

Regras:
- Isolamento total de banco de dados por `companyId`.
- JWT carrega `companyId` e `role`.
- Proteção nativa contra SSRF e Injeção de dependências em automações.
- Módulos auditados: Contacts, Tickets, Users, Workflows, AI Hub, Dashboard, Settings.

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

---

## 7. Roadmap de Evolução

- **Sprint 1 (Atual)**: Finalização do Hub de Notificações via WebSocket e Mobile Push.
- **Sprint 2**: IA Generativa para criação automática de fluxos de atendimento.
- **Sprint 3**: Integrações nativas com CRMs externos (Salesforce/Hubspot) via Webhooks BI.
- **Sprint 4**: Broadcast/Marketing em massa com IA para personalização de mensagens.
