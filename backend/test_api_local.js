const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const agent = await prisma.aIAgent.findFirst({
            where: { name: 'SUPORTE SISTEMA - KSAGRO' }
        });

        if (!agent) {
            console.log('Agente não encontrado.');
            return;
        }

        console.log(`Agent ID: ${agent.id}`);
        console.log(`Agent Model: ${agent.modelId}`);
        console.log(`Agent KB: ${agent.knowledgeBaseId}`);

        // Let's directly query the vector store service FTS logic exactly like the app does.
        const safeLang = 'portuguese';
        const queryText = 'onde lanço uma NF de insumos?';
        const kbId = agent.knowledgeBaseId;

        const candidates = await prisma.$queryRaw`
            WITH fts_results AS (
                SELECT
                    chunk.id,
                    chunk.content,
                    chunk."documentId",
                    doc.title as "documentTitle",
                    ts_rank_cd(
                        to_tsvector(${safeLang}::regconfig, chunk.content),
                        plainto_tsquery(${safeLang}::regconfig, ${queryText})
                    ) AS text_score
                FROM document_chunks chunk
                JOIN documents doc ON doc.id = chunk."documentId"
                WHERE doc.status = 'READY'
                  AND doc."knowledgeBaseId" = ${kbId}
            )
            SELECT id, text_score, substring(content from 1 for 100) as content FROM fts_results 
            WHERE text_score > 0
            ORDER BY text_score DESC
            LIMIT 5;
        `;

        console.log('\nResultados da Busca (FTS Restrito) para a Pergunta:');
        console.log(candidates);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
