const { Client } = require('pg');

async function dropPrismaMigrations() {
  const client = new Client({
    connectionString: "postgres://postgres:P-E1OueDVl6FzORA-Y-6dtMQj2u-aTKM@autorack.proxy.rlwy.net:11425/railway",
    ssl: false
  });

  try {
    await client.connect();
    console.log("Conectado ao DB");
    await client.query('DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;');
    console.log("Tabela _prisma_migrations removida com sucesso");
  } catch (err) {
    console.error("Erro ao remover a tabela:", err);
  } finally {
    await client.end();
  }
}

dropPrismaMigrations();
