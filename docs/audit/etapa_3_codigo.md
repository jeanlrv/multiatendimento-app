# Auditoria Técnica - Etapa 3: Auditoria de Código (Code Smells)

## 1. Classes Gigantes (God Objects)
- **AIService (1400+ linhas)**: Concentra lógica de RAG, Chat, Sumarização, Cache Semântico, Gestão de Tokens e Multimodal.
- **TicketsService (490+ linhas)**: Mistura CRUD básico com lógica de atribuição automática, auditoria e integração com IA.
- **ChatService (630+ linhas)**: Gere o estado do ticket, envio externo, análise de sentimento e roteamento de IA.

## 2. Acúmulo de Dívida Técnica (Code Smells)
- **Uso Excessivo de `as any`**: Encontrado em 23 arquivos principais. Isso anula os benefícios do TypeScript e mascara erros de tipagem em tempo de compilação.
- **Configurações Hardcoded**: Tabelas de custos de tokens e downgrades de modelos estão definidas como constantes privadas dentro dos serviços (`AIService`).
- **Lógica de Grafo Manual**: O motor de simulação de workflows usa um loop `while` com múltiplos `ifNodeType`, dificultando a extensão para novos tipos de nós.

## 3. Qualidade e Manutenibilidade
- **Baixa Coesão**: Os serviços de "negócio" têm alto conhecimento de infraestrutura (Prisma, Z-API, BullMQ).
- **Tratamento de Erros Inconsistente**:
    - Presença de `catch (e) { }` (silent failure) em fluxos de cache e sanitização.
    - Captura genérica de erros que retorna `ServiceUnavailableException`, ocultando a causa real (ex: timeout vs erro de API).
- **Injeção de Prompt**: A construção de instruções de roteamento está acoplada ao `ChatService`, dificultando a internacionalização ou personalização por empresa.

## 4. Código Morto e Redundância
- **Sanitização de WhatsApp**: Lógica de conversão de Markdown duplicada ou espalhada.
- **Validations**: Algumas validações de propriedade de ticket são repetidas manualmente em vez de usar Interceptors ou Guards de nível de método.

## Conclusão da Etapa
O código é funcional e rico em recursos, mas atingiu um nível de complexidade onde mudanças em uma área (ex: IA) podem afetar inesperadamente outras (ex: Workflows) devido ao alto acoplamento e transações longas.
