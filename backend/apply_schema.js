const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applySchema() {
  const client = new Client({
    connectionString: "postgres://postgres:P-E1OueDVl6FzORA-Y-6dtMQj2u-aTKM@autorack.proxy.rlwy.net:11425/railway",
    ssl: false
  });

  try {
    const sql = fs.readFileSync(path.join(__dirname, 'create_tables.sql'), 'utf-8');
    
    await client.connect();
    console.log("Conectado ao DB. Aplicando SQL...");
    
    // Divide o SQL em comandos individuais para melhor tratamento de erro
    // ou executa tudo caso o arquivo seja seguro
    await client.query(sql);
    
    console.log("SQL aplicado com sucesso! Estrutura do DB atualizada.");
  } catch (err) {
    console.error("Erro ao aplicar SQL:", err.message);
  } finally {
    await client.end();
  }
}

applySchema();
