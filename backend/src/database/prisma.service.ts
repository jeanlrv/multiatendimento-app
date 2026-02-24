import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        console.log('📡 Tentando conectar ao PostgreSQL via Prisma...');
        await this.$connect();
        console.log('✅ Conectado ao banco de dados PostgreSQL');
    }

    async onModuleDestroy() {
        await this.$disconnect();
        console.log('👋 Desconectado do banco de dados');
    }

    async cleanDatabase() {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Não é permitido limpar o banco em produção!');
        }

        const models = Reflect.ownKeys(this).filter(
            (key) => key[0] !== '_' && key[0] !== '$',
        );

        return Promise.all(
            models.map((modelKey) => {
                const model = this[modelKey as string];
                if (model && typeof model.deleteMany === 'function') {
                    return model.deleteMany();
                }
            }),
        );
    }
}
