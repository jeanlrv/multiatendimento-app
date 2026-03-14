# Auditoria Técnica - Etapa 2: Modelagem da Arquitetura Atual

## Padrão Arquitetural Atual
O sistema segue o padrão de **Monolito Modularizado** (NestJS), organizado por módulos funcionais. Embora a estrutura de diretórios sugira uma boa separação, a implementação interna revela desafios de manutenção.

### Identificações Técnicas:
- **Acoplamento de Dados**: Alto acoplamento com o Prisma ORM. Os `@Injectable() services` realizam queries complexas, transações e manipulação direta de modelos do banco de dados.
- **Separação de Camadas**: A camada de `Infraestrutura` (Acesso a dados, APIs externas) está misturada com a `Lógica de Negócio`. Não há uma camada de `Repositório` ou `Domínio` puras.
- **Controllers "Gordos"**: O `WebhooksController` concentra responsabilidades excessivas (parsing, validação, roteamento de negócio, persistência), dificultando testes unitários isolados.
- **Violação de SRP (Single Responsibility Principle)**: O `TicketsService` acumula responsabilidades de CRUD, automação de fila, auditoria, análise de IA e envio de mensagens (CSAT).

## Diagnóstico SOLID
- **S (Single Responsibility)**: Baixa conformidade em serviços centrais (`Tickets`, `WhatsApp`).
- **O (Open/Closed)**: Difícil extensão. Para adicionar um novo gateway (ex: WABA oficial), seria necessário alterar profundamente o `WebhooksController` e o `WhatsAppService`.
- **L (Liskov Substitution)**: Pouco uso de interfaces nas abstrações de serviços.
- **I (Interface Segregation)**: Interfaces de DTOs e Modelos Prisma são repassadas integralmente, gerando dependência de campos não utilizados.
- **D (Dependency Inversion)**: Violado pela dependência direta do `PrismaService` (implementação) em vez de uma abstração de repositório.

## Comparativo: Atual vs. Alvo

| Aspecto | Arquitetura Atual | Arquitetura Alvo Recomendada |
| :--- | :--- | :--- |
| **Acesso a Dados** | Injeção direta de `PrismaService` | Repository Pattern isolando o ORM |
| **Lógica de Negócio** | Espalhada em Services e Controllers | Domain Services e Use Cases isolados |
| **Integrações (Z-API)**| Acoplamento direto no Controller | Adapter Pattern / Gateways Abstratizados |
| **Processamento Local** | Lógica síncrona complexa | Handlers específicos / Command Pattern |
| **Testabilidade** | Difícil (requer muitos mocks de DB) | Alta (testes de unidade em lógica pura) |

## Proposta de Arquitetura Alvo
Para preparar o sistema para escala e manutenção a longo prazo, propõe-se a migração incremental para uma estrutura inspirada em **Clean Architecture / Hexagonal Architecture**:

1.  **Domain Layer**: Entidades e regras de negócio sem dependências externas.
2.  **Application Layer (Use Cases)**: Orquestração das regras de negócio (ex: `CreateTicketUseCase`).
3.  **Infrastructure Layer**: Implementações concretas de Repositórios (Prisma) e Adapters (Z-API, S3).
4.  **Interface Layer (Adapters)**: Controllers e Gateways que convertem requisições externas para o domínio.
