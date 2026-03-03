const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    try {
        const agent = await prisma.aIAgent.findFirst({
            where: { name: 'SUPORTE SISTEMA - KSAGRO' }
        });

        fs.writeFileSync('prompt_out.txt', agent.prompt);
        console.log('Salvo em prompt_out.txt');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
