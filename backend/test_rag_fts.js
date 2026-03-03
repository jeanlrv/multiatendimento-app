const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const safeLang = 'portuguese';
        const queryText = 'ola testando base';
        const companyId = 'a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6'; // random, not needed if we have kbId

        // Try finding the first KB to test
        const document = await prisma.document.findFirst({
            where: { status: 'READY', knowledgeBaseId: { not: undefined } }
        });

        if (!document) {
            console.log('Nenhum documento READY encontrado para testar FTS.');
            return;
        }

        const kbId = document.knowledgeBaseId;
        console.log(`Testando FTS com KB: ${kbId}`);

        const res = await prisma.$queryRaw`
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
              AND chunk.embedding IS NOT NULL
        )
        SELECT id, text_score, substring(content from 1 for 50) as content FROM fts_results 
        WHERE text_score > 0
        ORDER BY text_score DESC
        LIMIT 5;
    `;
        console.log('Resultado do FTS restrito SQL:', res);
    } catch (e) {
        console.error('Erro na query SQL Prisma:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
