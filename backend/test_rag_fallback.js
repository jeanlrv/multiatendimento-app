const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
    try {
        const kbId = 'f8316b5e-642d-4000-a5af-40e3f8c69be7';
        console.log('Fetching chunks with embedding !== null...');
        const chunks = await prisma.documentChunk.findMany({
            where: {
                document: {
                    status: 'READY',
                    knowledgeBaseId: kbId
                },
                embedding: { not: null },
            },
            take: 2,
            select: { id: true, content: true, embedding: true }
        });
        console.log(`Encontrei ${chunks.length} chunks com embedding.`);
        if (chunks.length > 0) {
            console.log('Primeiro chunk ID:', chunks[0].id);
            console.log('Tamanho do Embedding array:', chunks[0].embedding.length);
            const score = await cosineSimilarity(chunks[0].embedding, chunks[0].embedding);
            console.log('Cosine Score teste ID v ID (esperado 1):', score);
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
