/**
 * Script de migração de dados entre bancos Railway
 * OLD: maglev.proxy.rlwy.net:34893 (sem pgvector)
 * NEW: autorack.proxy.rlwy.net:11425 (com pgvector)
 */
import { PrismaClient } from '@prisma/client';

const OLD_URL = 'postgresql://postgres:AuvvjBQRgDkkBItkIHpnbazQwJsKbHPV@maglev.proxy.rlwy.net:34893/railway';
const NEW_URL = 'postgres://postgres:P-E1OueDVl6FzORA-Y-6dtMQj2u-aTKM@autorack.proxy.rlwy.net:11425/railway';

const oldDb = new PrismaClient({ datasources: { db: { url: OLD_URL } } });
const newDb = new PrismaClient({ datasources: { db: { url: NEW_URL } } });

const BATCH = 200;

async function copyTable(tableName, orderBy = 'id') {
  const countRes = await oldDb.$queryRawUnsafe(`SELECT COUNT(*) as n FROM "${tableName}"`);
  const total = parseInt(countRes[0].n);
  if (total === 0) { console.log(`  ${tableName}: vazio, pulando`); return; }

  let offset = 0;
  let copied = 0;
  while (offset < total) {
    const rows = await oldDb.$queryRawUnsafe(
      `SELECT * FROM "${tableName}" ORDER BY "${orderBy}" LIMIT ${BATCH} OFFSET ${offset}`
    );
    if (!rows.length) break;

    // Construir INSERT com ON CONFLICT DO NOTHING para segurança
    const cols = Object.keys(rows[0]).map(c => `"${c}"`).join(', ');
    for (const row of rows) {
      const vals = Object.values(row).map(v => {
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (typeof v === 'number') return v;
        if (v instanceof Date) return `'${v.toISOString()}'`;
        if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      try {
        await newDb.$executeRawUnsafe(
          `INSERT INTO "${tableName}" (${cols}) VALUES (${vals.join(', ')}) ON CONFLICT DO NOTHING`
        );
      } catch (e) {
        console.warn(`    AVISO row ${row.id}: ${e.message.substring(0, 120)}`);
      }
    }
    copied += rows.length;
    offset += BATCH;
    process.stdout.write(`\r  ${tableName}: ${copied}/${total}`);
  }
  console.log(`\r  ${tableName}: ${copied}/${total} ✓`);
}

// Ordem respeitando foreign keys
const TABLES = [
  'companies',
  'roles',
  'users',
  'departments',
  'smtp_configs',
  'settings',
  'feature_flags',
  'whatsapp_instances',
  'integrations',
  'tags',
  'contacts',
  'saved_filters',
  'canned_responses',
  'user_departments',
  'ai_agents',
  'workflow_rules',
  'workflow_rule_versions',
  'tickets',
  'ticket_tags',
  'messages',
  'evaluations',
  'audit_logs',
  'refresh_tokens',
  'ai_usage',
  'notifications',
  'push_subscriptions',
  'internal_chats',
  'internal_chat_members',
  'internal_chat_messages',
  'workflow_executions',
  'workflow_action_metrics',
  'workflow_suspensions',
  'broadcasts',
  'broadcast_recipients',
  'schedules',
  'schedule_configs',
  'schedule_reminders',
  'department_flows',
  'knowledge_bases',
  'documents',
  'document_chunks',
  'kb_sync_logs',
  'conversations',
  'conversation_messages',
  'embed_chat_sessions',
  'embed_chat_messages',
  'provider_configs',
  'customers',
];

async function main() {
  console.log('=== MIGRAÇÃO DE DADOS RAILWAY ===\n');

  // Desabilitar FK constraints no novo banco durante a importação
  await newDb.$executeRawUnsafe(`SET session_replication_role = 'replica'`);
  console.log('FK constraints desabilitadas temporariamente\n');

  let success = 0;
  let skipped = 0;

  for (const table of TABLES) {
    try {
      // Verificar se tabela existe no banco antigo
      const exists = await oldDb.$queryRawUnsafe(
        `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}'`
      );
      if (!exists.length) { console.log(`  ${table}: não existe no banco antigo, pulando`); skipped++; continue; }

      // Verificar se tabela existe no novo banco
      const existsNew = await newDb.$queryRawUnsafe(
        `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}'`
      );
      if (!existsNew.length) { console.log(`  ${table}: não existe no banco novo, pulando`); skipped++; continue; }

      const orderCol = await oldDb.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' AND column_name IN ('id','createdAt','sentAt') LIMIT 1`
      );
      const order = orderCol[0]?.column_name || 'id';
      await copyTable(table, order);
      success++;
    } catch (e) {
      console.error(`  ${table}: ERRO — ${e.message.substring(0, 200)}`);
      skipped++;
    }
  }

  // Reabilitar FK constraints
  await newDb.$executeRawUnsafe(`SET session_replication_role = 'origin'`);
  console.log('\nFK constraints reabilitadas');

  console.log(`\n=== CONCLUÍDO: ${success} tabelas migradas, ${skipped} puladas ===`);

  // Resumo de registros no novo banco
  console.log('\n--- Resumo do novo banco ---');
  for (const t of ['companies', 'users', 'contacts', 'tickets', 'messages', 'document_chunks']) {
    const r = await newDb.$queryRawUnsafe(`SELECT COUNT(*) as n FROM "${t}"`).catch(() => [{n:0}]);
    console.log(`  ${t}: ${r[0].n} registros`);
  }

  await oldDb.$disconnect();
  await newDb.$disconnect();
}

main().catch(e => { console.error('FALHA FATAL:', e.message); process.exit(1); });
