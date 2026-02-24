import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function debug() {
    const email = 'admin@whatsapp-saas.com'.toLowerCase();
    const pass = 'Admin@123';

    process.stdout.write(`\n--- INICIANDO DEBUG DE LOGIN ---\n`);
    process.stdout.write(`Testando email: ${email}\n`);

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: { role: true }
        });

        if (!user) {
            process.stdout.write(`ERRO: Usuário não encontrado no banco!\n`);
            const allUsers = await prisma.user.findMany({ select: { email: true } });
            process.stdout.write(`Usuários existentes: ${allUsers.map(u => u.email).join(', ') || 'NENHUM'}\n`);
            return;
        }

        process.stdout.write(`Usuário encontrado: ${user.name} (ID: ${user.id})\n`);
        process.stdout.write(`Role: ${user.role?.name || 'SEM ROLE'}\n`);

        const isMatch = await bcrypt.compare(pass, user.password);
        process.stdout.write(`Comparação de senha ('${pass}'): ${isMatch ? 'SUCESSO ✅' : 'FALHA ❌'}\n`);

        if (!isMatch) {
            process.stdout.write(`Hash no banco: ${user.password}\n`);
            const newHash = await bcrypt.hash(pass, 10);
            process.stdout.write(`Novo hash gerado para comparação: ${newHash}\n`);
        }

    } catch (error: any) {
        process.stdout.write(`ERRO CRÍTICO NO PRISMA: ${error.message}\n`);
    } finally {
        await prisma.$disconnect();
    }
}

debug();
