import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@whatsapp-saas.com';
    const rawPassword = 'Admin@123';

    console.log(`Resetando senha para ${email}...`);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    await prisma.user.update({
        where: { email },
        data: { password: hashedPassword }
    });

    console.log('Senha resetada com sucesso.');

    // Teste imediato de comparação
    const user = await prisma.user.findUnique({ where: { email } });
    const isMatch = await bcrypt.compare(rawPassword, user!.password);
    console.log(`Teste de comparação interna: ${isMatch ? 'SUCESSO' : 'FALHA'}`);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
