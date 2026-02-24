# KSZap Aero – Product Requirements Document (PRD) 

## 1. Visão Geral

O KSZap Aero é uma plataforma SaaS multiempresa para gestão de atendimentos, agenda, contatos e workflows inteligentes.

O sistema é estruturado para:

- Multiempresa (Tenant-based architecture)
- Controle de acesso por papéis (RBAC)
- Escalabilidade horizontal
- Experiência CRM moderna
- Interface Liquid Glass com Dark Mode nativo

---

## 2. Objetivos do Produto

- Permitir que múltiplas empresas utilizem a plataforma de forma isolada (Multi-tenancy).
- Fornecer CRM completo de contatos com métricas de risco.
- Automação inteligente via Workflows baseados em grafos.
- Atendimento híbrido (Humano + IA) com análise de sentimento em tempo real.
- Interface Liquid Glass de alto desempenho.

---

## 3. Arquitetura Multiempresa

Cada dado pertence obrigatoriamente a uma empresa (`companyId`).

Regras:
- Isolamento total de banco de dados por `companyId`.
- JWT carrega `companyId` e `role`.
- Guards globais e locais garantem que um usuário jamais acesse dados de outro tenant.
- Módulos auditados: Contacts, Tickets, Users, Workflows, AI, Dashboard, Settings.

---

## 4. Módulo de Contatos (CRM)

- Cadastro, busca e segmentação.
- Risk Score (0-100): Avalia comportamento e feedbacks.
- Importação/Exportação CSV.
- Histórico completo de tickets vinculado.

---

## 5. Motor de Workflows (Smart Flow V2)

- Builder visual de nós e arestas.
- Gatilhos: Mensagem Recebida, Mudança de Status, Eventos Manuais.
- Ações: Envio de texto/mídia, Transferência de setor, Delays, IA Intent (Classificação).
- Versionamento e Simulação em tempo real antes da ativação.

---

## 6. Inteligência Artificial (Powered by AnythingLLM)

- **Transcrição**: Áudios de WhatsApp convertidos em texto automaticamente.
- **Sentiment**: Classificação (Positivo, Neutro, Negativo) em cada interação.
- **RAG**: Base de conhecimento customizável por departamento.
- **Sugestão**: Copilot que sugere respostas baseadas no contexto.

---

## 7. Roadmap de Evolução

- **Sprint 1 (Próximo)**: Integração com Webhooks externos (Saída de dados).
- **Sprint 2**: Dashboard em tempo real via Websockets.
- **Sprint 3**: App Mobile (PWA) e notificações push nativas.
- **Sprint 4**: Fluxos de Broadcast/Marketing segmentados.
