# Novo Relatório de Revisão Técnica - Passes 1, 2 e 3 (review-pr.md)

Este relatório foca nos módulos de **Autenticação (Auth)**, **Tickets** e **SLA Monitor**, complementando a análise anterior focada em IA e Webhooks.

---

## 🏗️ Pass 1: Estrutura (Arquitetura e Responsabilidades)

- **Auth**: A estrutura está impecável. Uso correto de `Guards` e `Strategies` do Passport. A lógica de renovação de tokens (Refresh Tokens) está desacoplada da emissão de Access Tokens, seguindo os padrões OAuth2/OIDC.
- **Tickets**: Apesar de ser um serviço grande (~36KB), a responsabilidade está bem distribuída. O uso de `EventEmitter2` para disparar CSAT e Auditoria evita o acoplamento excessivo.
- **SLA Monitor**: Excelente uso do BullMQ para processamento em background. O serviço é reativo e independente, o que garante que o monitoramento não gere gargalos nas requisições principais do usuário.

## 🧠 Pass 2: Lógica (Correção e Edge Cases)

- **Distribuição Automática**: O algoritmo de *Round-Robin* (atribuição ao agente com menor carga) é robusto e evita sobrecarga de atendentes.
- **SLA Progressivo**: O sistema lida bem com os limiares de 75%, 90% e 100%, escalando a prioridade e realizando a redistribuição automática no limite máximo.
- **Mesclagem de Tickets**: A lógica de transferência de mensagens e tags entre tickets lida corretamente com duplicatas de tags.

## 🛡️ Pass 3: Segurança (Vulnerabilidades e Proteção de Dados)

- **Access Tracking**: Uso de `publicToken` opaco para o portal do cliente. Isso é uma excelente prática de segurança (mitiga ID Enumeration Attacks).
- **Proteção XSS/CSRF**: A implementação de `httpOnly` cookies com `SameSite: Lax` e `Secure` (em produção) protege os tokens de serem acessados via scripts maliciosos.
- **Isolamento de Tenant**: Todas as queries Prisma de busca e atualização incluem explicitamente o `companyId`, garantindo o isolamento total entre empresas no modelo SaaS.
- **Rate Limiting**: O uso de `@Throttle` em rotas sensíveis como `/auth/login` e `/tickets/public/:token` previne ataques de força bruta.

---

## 📊 Output Final

### 1. Issues encontradas (por severidade)

🟢 **Média/Baixa Severidade**
- **Persistência de Notificações de SLA**: O `SlaMonitorService` usa um Map em memória (`breachNotifiedAt`) para controle de cooldown de notificações. Em caso de reinicialização do pod/servidor, o estado é perdido e notificações podem ser disparadas novamente em duplicidade. 
  - *Sugestão*: Migrar este cache para o Redis (que o sistema já utiliza).
- **Redistribuição de Tickets Offline**: A lógica de redistribuição automática no `SlaMonitorService` verifica apenas se o usuário `isActive`, mas não se ele está online (via socket/status). Isso pode transferir um ticket crítico para um atendente que terminou seu turno.
- **Exportação CSV**: A sanitização de campos complexos na exportação de CSV (`TicketsService.exportCsv`) poderia ser mais robusta para prevenir "CSV Injection" em Excel caso usuários externos utilizem nomes de contato com fórmulas (ex: `=SUM...`).

### 2. Sugestões de melhoria

1. **Check de Status Online**: No `SlaMonitorService.redistributeTicket`, incluir uma verificação de status online (ex: integração com o presence service do Socket.io) antes de transferir.
2. **Refatoração do TicketsService**: Dada a complexidade, as funcionalidades secundárias (Agendamento de mensagens, Exportação, Merge) poderiam ser extraídas para serviços auxiliares (`TicketsSchedulingService`, `TicketsExportService`) para facilitar a manutenção e testes.
3. **Persistência de Cooldown**: Utilizar o Redis com TTL para o `breachNotifiedAt` no SLA Monitor.

### 3. Parecer

✅ **APROVADO COM RECOMENDAÇÕES**.
O sistema demonstra maturidade técnica superior, com foco claro em segurança de dados e resiliência de negócios. As sugestões visam otimizar a experiência em escala e prevenir duplicidades operacionais.

---
Análise realizada em 19/03/2026.
