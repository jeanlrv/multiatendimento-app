
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const configs = await prisma.providerConfig.findMany();
        console.log('--- PROVIDER CONFIGS (' + configs.length + ') ---');
        configs.forEach(c => {
            console.log(`Provider: ${c.provider}, Enabled: ${c.isEnabled}, Category: ${c.category}`);
        });

        const agents = await prisma.aIAgent.findMany();
        console.log('\n--- AI AGENTS (' + agents.length + ') ---');
        agents.forEach(a => {
            console.log(`ID: ${a.id}, Name: ${a.name}, Model: ${a.modelId}, Active: ${a.isActive}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
