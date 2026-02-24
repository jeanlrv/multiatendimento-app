import { PrismaClient } from '@prisma/client';

async function test() {
    console.log('Iniciando teste de conexão Prisma...');
    const prisma = new PrismaClient();
    try {
        await prisma.$connect();
        console.log('✅ Conexão bem-sucedida!');
        const users = await prisma.user.count();
        console.log('Contagem de usuários:', users);
    } catch (error) {
        console.error('❌ Erro na conexão:', error);
    } finally {
        await prisma.$disconnect();
    }
}

test();
