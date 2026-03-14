# Plano de Refatoração Estrutural - KSZap

Este plano detalha as ações para elevar o sistema KSZap a um padrão de engenharia profissional, resolvendo os problemas identificados durante a auditoria técnica.

## User Review Required

> [!IMPORTANT]
> A migração para o **Repository Pattern** e a extração de Use Cases alterará a estrutura de injeção de dependência em diversos módulos. Isso será feito de forma incremental para não interromper o sistema em produção.

> [!WARNING]
> A correção do **Distributed Lock** requer a atualização da lógica de liberação no Redis, o que é crítico para a estabilidade do motor de Workflows.

---

## Proposed Changes

### 1. Camada de Infraestrutura e Estabilidade
**Objetivo**: Corrigir bugs de concorrência e lock.

#### [MODIFY] [lock.service.ts](file:///c:/Users/Jean/OneDrive/Documentos/multiatendimento-app/backend/src/modules/workflows/core/lock.service.ts)
- Implementar liberação de lock via script Lua para garantir atomicidade (ID de posse).

#### [MODIFY] [webhooks.controller.ts](file:///c:/Users/Jean/OneDrive/Documentos/multiatendimento-app/backend/src/modules/whatsapp/webhooks.controller.ts)
- Migrar lógica de criação de contato/ticket para usar `upsert` ou transações com isolamento adequado para evitar duplicidade.

---

### 2. Refatoração do Módulo de IA (Decomposition)
**Objetivo**: Quebrar o "God Object" `AIService` e otimizar performance.

#### [NEW] [ai-cache.service.ts]
- Isolar a lógica de Cache Semântico. Substituir a iteração linear por uma busca vetorial eficiente ou reduzir o TTL/tamanho do cache.

#### [NEW] [ai-token-manager.service.ts]
- Isolar a gestão de limites e tracking de tokens.

#### [MODIFY] [ai.service.ts](file:///c:/Users/Jean/OneDrive/Documentos/multiatendimento-app/backend/src/modules/ai/ai.service.ts)
- Reduzir responsabilidades, focando apenas na orquestração de chat/multimodal.

---

### 3. Padronização de Tipagem e Erros
**Objetivo**: Eliminar `as any` e unificar tratamento de exceções.

#### [MODIFY] Diversos Arquivos
- Substituir `as any` por interfaces DTO ou tipos gerados pelo Prisma.
- Implementar um Global Exception Filter customizado para melhor detalhamento de erros de IA/Workflows.

---

### 4. Extração de Lógica de Negócio (Use Cases)
**Objetivo**: Desacoplar Services do Prisma.

#### [NEW] [repositories/ticket.repository.ts]
- Abstrair queries do Prisma.

#### [NEW] [use-cases/create-ticket.use-case.ts]
- Isolar a lógica complexa de criação e atribuição do `TicketsService`.

---

## Verification Plan

### Automated Tests
1. **Teste de Concorrência de Webhook**: Script em Python/Node para disparar 10 requisições simultâneas para o mesmo número novo e validar que apenas 1 contato e 1 ticket foram criados.
2. **Teste de Lock**: Validar que um processo não pode liberar o lock de outro.
3. **Unit Tests**: Testar o `ai-cache.service` isoladamente para garantir que o cleanup funciona.

### Manual Verification
1. **Fluxo de Chat**: Validar que a resposta da IA continua fluida após a decomposição do serviço.
2. **Workflows**: Simular o Aero Flow e verificar os logs no BullMQ.
