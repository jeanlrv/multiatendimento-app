
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:AuvvjBQRgDkkBItkIHpnbazQwJsKbHPV@maglev.proxy.rlwy.net:34893/railway';

async function fix() {
    const client = new Client({ connectionString });
    await client.connect();
    console.log('📡 Conectado ao banco do Railway...');

    try {
        console.log('📦 Tentando criar extensão vector...');
        await client.query('CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";');
        console.log('✅ Extensão vector criada ou já existente.');

        console.log('🔨 Alterando tabela document_chunks...');
        // Verificando se a coluna é vector ou json
        const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'document_chunks' AND column_name = 'embedding';");
        console.log('Estado atual da coluna embedding:', res.rows[0]);

        if (res.rows[0] && res.rows[0].data_type !== 'USER-DEFINED') { // USER-DEFINED costuma ser o vector
            await client.query('ALTER TABLE "document_chunks" DROP COLUMN "embedding";');
            await client.query('ALTER TABLE "document_chunks" ADD COLUMN "embedding" vector;');
            console.log('✅ Coluna embedding convertida para vector.');
        } else {
            console.log('ℹ️ A coluna já parece ser do tipo vector ou não existe.');
        }

    } catch (err) {
        console.error('❌ Erro durante a execução do SQL:', err.message);
        if (err.message.includes('extension "vector" is not available')) {
            console.error('🚨 O PostgreSQL do Railway pode não ter a extensão pgvector instalada ou habilitada.');
        }
    } finally {
        await client.end();
    }
}

fix();
