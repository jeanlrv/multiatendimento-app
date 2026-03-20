const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applySchemaSplit() {
  const client = new Client({
    connectionString: "postgres://postgres:P-E1OueDVl6FzORA-Y-6dtMQj2u-aTKM@autorack.proxy.rlwy.net:11425/railway",
    ssl: false
  });

  try {
    const rawSql = fs.readFileSync(path.join(__dirname, 'create_tables_utf8.sql'), 'utf-8');
    
    // Divide por ';' e filtra as vazias
    const queries = rawSql
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0);
    
    await client.connect();
    console.log(`Conectado ao DB. Processando ${queries.length} queries...`);

    let successCount = 0;
    
    for (let i = 0; i < queries.length; i++) {
        try {
            await client.query(queries[i]);
            successCount++;
        } catch(qe) {
            console.error(`\nErro na query ${i+1}:\n${queries[i].substring(0, 100)}...\n>> ${qe.message}`);
            // Continuamos tentando as outras (ex: se for index falho)
        }
    }
    
    console.log(`\nFinalizado. Sucesso: ${successCount} / ${queries.length}`);
  } catch (err) {
    console.error("Erro geral no script:", err.message);
  } finally {
    await client.end();
  }
}

applySchemaSplit();
