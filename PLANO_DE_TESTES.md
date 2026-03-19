# Sugestões de Testes Automatizados - Multi-Atendimento SaaS

Baseado na arquitetura do seu projeto (NestJS, Next.js, BullMQ, Redis, Prisma, Integração Z-API e LLMs), aqui está a estratégia recomendada de testes para garantir a máxima resiliência, focando primeiro no que gera mais problemas em produção.

---

## 🛑 Nível 1: Testes Unitários de Lógica Crítica (Rápidos / Essenciais)
*Onde colocar:* Arquivos `.spec.ts` no mesmo diretório do serviço.
*Foco:* Funções puras, formatação e limiares de segurança.

**Backend (`ai-chat.service.spec.ts` / `webhook-processing.service.spec.ts`)**
1. **Extrator de Payload do Webhook**: Testar `extractMessageContent()` garantindo que mapeie perfeitamente textos, contatos compartilhados, localizações, fallbacks com chaves incomuns da Z-API, mídias vazias, e etc.
2. **Cálculo de Fuso Horário Comercial**: Testar a função `checkBusinessHours()` mockando o date do sistema para várias condições: fora de hora, feriados, fusos de estados com diferença do horário de braśília e limite exato do minuto final.
3. **Controlador de Tokens da IA**: Avaliar detalhadamente a `allocateTokenBudget()` enviando textos longos, curtos e com *filler words* (ok, tchau) para validar se atribui corretamente o desconto.
4. **Downgrade Inteligente de Modelo**: Testar se o mapa estrutural da IA garante o *fall-back* (ex: de GTP-4o para 4o-mini quando o `budget.chunkLimit` é menor).
5. **Autenticação e Rotação**: Testar o ciclo de expiração e emissão de JWT, e a limpeza de Refresh Tokens (`cleanupExpiredTokens`).

**Frontend**
- **Extração Markdown na UI**: Testar via *React Testing Library* se o componente contendo a mensagem processa corretamente blocos markdown complexos recebidos da IA, sem quebrar ou dar inject de script no DOM.

---

## 🚆 Nível 2: Testes de Integração (O Coração do SaaS)
*Onde colocar:* Pasta `/test` (Backend) simulando o banco com DB in-memory ou transações com rollback.
*Foco:* Integração de banco, cache e locks.

1. **Race Conditions no Webhook Z-API**:
   - *Cenário:* Disparar concorrentemente (em paralelo usando `Promise.all`) 3 webhooks do MESMO contato para abrir o ticket.
   - *Expectativa:* O `lockService.acquireWithRetry` deve permitir a criação de apenas UM contato novo em BD, barrando duplicação via TOCTOU (Time of Check to Time of Use).
2. **Fluxo de CSAT (Satisfação)**:
   - *Cenário:* Enviar webhook com um texto contendo valor da nota de 1 a 5 quando a flag `csatPending` do contato estiver atrelada.
   - *Expectativa:* Verificar se atualiza a entidade de `Evaluation`, despacha o evento `csat.received` ou de mensagem posterior com conformidade.
3. **Resiliência da IA (Circuit Breaker)**:
   - *Cenário:* Mockar um erro estourando Time-Out ou 429 *Too Many Requests* no `LLMService`.
   - *Expectativa:* Após 3 falhas, a chamada para o gateway de IA deve abrir o circuito (*Circuit Breaker* em `ai-chat.service`) para prevenir chamadas enfileiradas e gargalo de eventos durante 60 segundos.
4. **Recuperação de Contexto (RAG)**:
   - *Cenário:* Testar se a rotina `buildRagSystemPrompt` limpa e unifica assertivamente os *chunks* de contexto na injeção do cabeçalho oficial do prompt de sistema, sem extrapolar os limites do modelo.

---

## 🌐 Nível 3: Testes Ponta-a-Ponta E2E (Simulação Real da Operação)
*Ferramenta Recomendada:* Playwright (ideal se precisar de múltiplos contextos isolados rápidos).
*Foco:* User Flow, Websockets.

1. **Tela do Painel do Atendente (Kanban / Chat)**:
   - *Cenário:* Login -> Clicar na aba de atendimento -> Disparar por API no backend um recebimento de mensagem webhook simulando cliente.
   - *Expectativa:* A UI deve mostrar instantâneamente a notificação SSE / WebSocket de nova mensagem sem necessitar de refresh manual do navegador (F5), exibindo contadores de filas (SLA) incrementados corretamente.
2. **Transferência de SLA / Equipes**:
   - *Cenário:* Logado como Atendente, transferir o chat para outro departamento que está offline.
   - *Expectativa:* Confirmar na interface o disparo do fluxo "offline", notificação enviada, status mudando para repassado à IA (ou Fechado) dependendo da regra configurada.

---

## 🎯 Por onde começar? (Ordem de Prioridade Prática)
Se for implementar na sprint, siga esta ordem vital:
1. **(Testes do Nível 1) `extractMessageContent()` do Webhooks e Rate Limits.** (Garante que mensagens de clientes não vão ser descartadas por crash ou payloads quebrados).
2. **(Testes do Nível 2) Locks do Redis + Concorrência de Contatos.** (Resolve problema de banco duplicando cadastros em rajada de webhooks).
3. **(Testes do Nível 2) Mock Failures da API da OpenAI.** (Resolve o backpressure da fila no BullMQ em caso de queda global de API).
