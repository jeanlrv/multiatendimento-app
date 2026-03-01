
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

async function main() {
    const prisma = new PrismaClient();
    try {
        const configs = await prisma.providerConfig.findMany();
        const agents = await prisma.aIAgent.findMany();
        const result = {
            configs,
            agents
        };
        fs.writeFileSync('db-dump.json', JSON.stringify(result, null, 2));
        console.log('Dump saved to db-dump.json');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
