# Auditoria Técnica - Etapa 4: Detecção de Bugs e Erros Lógicos

## 1. Condições de Corrida (Race Conditions)
- **Criação Duplicada de Tickets**: No `WebhooksController`, a lógica de "buscar ticket ativo ou criar novo" não é atômica. Webhooks simultâneos para o mesmo contato podem gerar múltiplos tickets abertos.
- **Gargalo de Contatos**: A criação de contatos também está sujeita a colisões de chave única em concorrência pesada, pois usa `findFirst` seguido de `create` em vez de `upsert`.

## 2. Bug de Lock Distribuído
- **Liberação Insegura**: O `LockService` libera chaves no Redis sem validar se o processo atual ainda é o dono do lock. Se uma execução exceder o TTL (30s) e liberar o lock, ela pode acidentalmente apagar o lock de uma nova execução que acabou de começar, quebrando a exclusividade mútua.

## 3. Eficiência e Performance da IA
- **Explosão de CPU no Cache Semântico**: O `AIService` itera sobre 2000 entradas de um Map em *cada* mensagem recebida para calcular a similaridade de cosseno. Isso causará latência linear crescente e picos de CPU à medida que o cache enche.
- **Chaves de Cache Ineficientes**: O uso de `Date.now()` na chave do cache impede que o sistema encontre hits por chave exata, forçando sempre a busca vetorial exaustiva no laço `for`.

## 4. Problemas de Localização e Datas
- **Manipulação Arriscada de Timezone**: O uso de `toLocaleString` para instanciar objetos `Date` no `ChatService` é dependente de locale e propenso a erros de parsing silenciosos, o que pode afetar o cálculo de "Fora do Expediente".

## 5. Integridade Transacional
- **Transações Longas no Chat**: O `ChatService.sendMessage` abre transações que incluem chamadas síncronas para o Prisma. Se o envio para o WhatsApp falhar, o status da mensagem é atualizado via `.catch`, mas a transação externa pode manter locks desnecessários por muito tempo dependendo da resposta da rede.
