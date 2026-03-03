const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const kbId = 'f8316b5e-642d-4000-a5af-40e3f8c69be7';
        const safeLang = 'portuguese';
        const queryText = 'onde lanço uma NF de insumos?';

        // Formata query como OR (palavra1 | palavra2 ...) 
        // Remover pontuações para não quebrar o plainto_tsquery:
        const cleanQuery = queryText.replace(/[^\w\s\u00C0-\u00FF]/g, '').trim().split(/\s+/).join(' | ');
        console.log("Query OR:", cleanQuery);

        const candidates = await prisma.$queryRaw`
            WITH fts_results AS (
                SELECT
                    chunk.id,
                    chunk.content,
                    chunk."documentId",
                    doc.title as "documentTitle",
                    ts_rank_cd(
                        to_tsvector(${safeLang}::regconfig, chunk.content),
                        to_tsquery(${safeLang}::regconfig, ${cleanQuery})
                    ) AS text_score
                FROM document_chunks chunk
                JOIN documents doc ON doc.id = chunk."documentId"
                WHERE doc.status = 'READY'
            )
            SELECT id, text_score, substring(content from 1 for 150) as content 
            FROM fts_results 
            WHERE text_score > 0
            ORDER BY text_score DESC
            LIMIT 5;
        `;

        console.log('\nResultados da Busca (FTS Relaxado OR):', candidates.length);
        if (candidates.length > 0) {
            console.log(candidates[0]);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
