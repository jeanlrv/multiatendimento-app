const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const agent = await prisma.aIAgent.findFirst({
            where: { name: 'SUPORTE SISTEMA - KSAGRO' }
        });

        console.log('--- System Prompt ---');
        console.log(agent.prompt);
        console.log('---------------------');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
