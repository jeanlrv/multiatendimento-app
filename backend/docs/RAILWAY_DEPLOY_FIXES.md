# Correções para Deploy no Railway

## Problemas Identificados e Corrigidos

### 1. Erro de Injeção de Dependência - BullQueue

**Erro:**
```
Nest can't resolve dependencies of the EmbeddingCacheService (PrismaService, ?). 
Please make sure that the argument "BullQueue_knowledge-processing" at index [1] is available
```

**Causa:** O `EmbeddingCacheService` injeta `@InjectQueue('knowledge-processing')`, mas o `AIEngineModule` não tinha acesso à fila configurada globalmente no `AppModule`.

**Solução:** O `AIEngineModule` foi simplificado para não reconfigurar o BullModule, já que ele já está configurado globalmente no `AppModule` via `BullModule.forRootAsync()`.

**Arquivo Modificado:**
- `backend/src/modules/ai/engine/ai-engine.module.ts`

### 2. Erro de Tipo "vector" não existe

**Erro:**
```
Error: ERROR: type "vector" does not exist
```

**Causa:** O schema Prisma usa o tipo `vector(1536)` para embeddings na tabela `document_chunks`, mas a extensão `pgvector` não estava habilitada no PostgreSQL do Railway.

**Solução:**
1. Criada nova migração para habilitar a extensão `pgvector` no PostgreSQL
2. Mantido apenas `postgresqlExtensions` no previewFeatures (o previewFeature `pgvector` não é suportado na versão do Prisma 6.19.2)
3. Renomeada a migração para ter timestamp anterior (`20260219000000`) para garantir que seja aplicada antes das outras migrações

**Arquivos Criados/Modificados:**
- `backend/prisma/migrations/20260219000000_enable_pgvector_extension/migration.sql` (novo)
- `backend/prisma/schema.prisma` (atualizado)
- `backend/prisma/migrations/migration_lock.toml` (atualizado)

## PreviewFeatures Correto

O previewFeature `pgvector` não é conhecido na versão do Prisma 6.19.2. Use apenas:

```prisma
generator client {
  provider        = "prisma-client-js"
  binaryTargets   = ["native", "linux-musl-openssl-3.0.x"]
  previewFeatures = ["postgresqlExtensions"]
}
```

A extensão `pgvector` é habilitada via SQL na migração, não via previewFeature.

## Ordem das Migrações

A migração `pgvector` deve ser a primeira para garantir que a extensão esteja disponível antes de qualquer tabela que use o tipo `vector`:

```
20260219000000_enable_pgvector_extension    ← PRIMEIRO (habilita pgvector)
20260220142556_init_enterprise
20260221000001_add_nodes_edges_to_workflow_version
20260222000001_sync_schema_roles_collaboration
20260222000002_users_roleid_not_null
20260222000003_indexes_columns_fixes
20260225000001_notifications
```

## Migrações Necessárias

Para aplicar as correções localmente:

```bash
cd backend
npx prisma migrate dev --name enable_pgvector_extension
npx prisma generate
```

## Deploy no Railway

Após fazer o push das alterações, o Railway irá:

1. Executar a migração `20260219000000_enable_pgvector_extension` que habilita a extensão `pgvector`
2. Aplicar as demais migrações existentes
3. Executar o seed do banco de dados
4. Iniciar a aplicação NestJS

## Variáveis de Ambiente Necessárias

Certifique-se de que as seguintes variáveis estão configuradas no Railway:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL de conexão com PostgreSQL |
| `REDIS_URL` | URL de conexão com Redis (opcional) |
| `JWT_SECRET` | Segredo para JWT |
| `JWT_REFRESH_SECRET` | Segredo para refresh tokens |
| `ENCRYPTION_KEY` | Chave para criptografia |

## Verificação Pós-Deploy

Após o deploy, verifique os logs para confirmar:

1. ✅ Migração pgvector aplicada com sucesso
2. ✅ Banco de dados disponível
3. ✅ Seed concluído com sucesso
4. ✅ Aplicação iniciada sem erros de dependência