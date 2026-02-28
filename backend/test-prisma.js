
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    console.log('Keys on prisma:', Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));

    try {
        const providerConfigs = await prisma.providerConfig.findMany();
        console.log('✅ Found providerConfig model');
    } catch (e) {
        console.error('❌ Error finding providerConfig:', e.message);
    }

    try {
        const integrations = await prisma.integration.findMany();
        console.log('✅ Found integration model');
    } catch (e) {
        console.error('❌ Error finding integration:', e.message);
    }

    try {
        const apiKeys = await prisma.apiKey.findMany();
        console.log('✅ Found apiKey model');
    } catch (e) {
        console.error('❌ Error finding apiKey:', e.message);
    }

    await prisma.$disconnect();
}

test();
