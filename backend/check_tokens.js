const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const companies = await prisma.company.findMany({
            select: { id: true, name: true, limitTokens: true, limitTokensPerHour: true, limitTokensPerDay: true }
        });
        console.log('--- Companies ---');
        console.log(JSON.stringify(companies, null, 2));

        const agents = await prisma.aIAgent.findMany({
            select: { id: true, name: true, limitTokensPerDay: true, companyId: true }
        });
        console.log('\n--- Agents ---');
        console.log(JSON.stringify(agents, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
