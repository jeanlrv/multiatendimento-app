import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';

process.on('uncaughtException', (err) => {
    console.error('❌ FATAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

function validateRequiredEnvVars() {
    const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error(`\n❌ ERRO CRÍTICO: Variáveis de ambiente JWT não definidas: ${missing.join(', ')}`);
        console.error('   O sistema não pode iniciar sem credenciais seguras.\n');
        process.exit(1);
    }

    // Validar força das chaves JWT
    const MIN_SECRET_LENGTH = 32;

    if ((process.env.JWT_SECRET?.length ?? 0) < MIN_SECRET_LENGTH) {
        console.error(`\n❌ ERRO CRÍTICO: JWT_SECRET é muito curto (${process.env.JWT_SECRET?.length || 0} caracteres, mínimo ${MIN_SECRET_LENGTH}).`);
        console.error('   Gere uma chave segura: openssl rand -base64 32\n');
        process.exit(1);
    }

    if ((process.env.JWT_REFRESH_SECRET?.length ?? 0) < MIN_SECRET_LENGTH) {
        console.error(`\n❌ ERRO CRÍTICO: JWT_REFRESH_SECRET é muito curto (${process.env.JWT_REFRESH_SECRET?.length || 0} caracteres, mínimo ${MIN_SECRET_LENGTH}).`);
        console.error('   Gere uma chave segura: openssl rand -base64 32\n');
        process.exit(1);
    }

    // Validar ENCRYPTION_KEY
    if (!process.env.ENCRYPTION_KEY) {
        console.error(`\n❌ ERRO CRÍTICO: ENCRYPTION_KEY não configurado — tokens serão armazenados em plaintext no banco.`);
        console.error('   Gere uma chave segura: openssl rand -base64 32\n');
        process.exit(1);
    }

    if ((process.env.ENCRYPTION_KEY?.length ?? 0) < MIN_SECRET_LENGTH) {
        console.error(`\n❌ ERRO CRÍTICO: ENCRYPTION_KEY é muito curto (${process.env.ENCRYPTION_KEY?.length || 0} caracteres, mínimo ${MIN_SECRET_LENGTH}).`);
        console.error('   Gere uma chave segura: openssl rand -base64 32\n');
        process.exit(1);
    }

    console.log('✅ Validação de ambiente concluída com sucesso.');
}

async function bootstrap() {
    try {
        validateRequiredEnvVars();
        const logger = new Logger('Bootstrap');
        const isDev = process.env.NODE_ENV !== 'production';
        const allowedOrigins = process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
            : isDev
                ? '*'
                : [];

        const app = await NestFactory.create<NestExpressApplication>(AppModule, {
            cors: {
                origin: allowedOrigins,
                credentials: true,
            },
        });

        // Graceful shutdown — aguarda requests em andamento antes de encerrar
        app.enableShutdownHooks();

        // Helmet — headers de segurança HTTP adicionais (complementa os do nginx)
        app.use(helmet({
            crossOriginResourcePolicy: { policy: 'cross-origin' }, // permite static assets
            contentSecurityPolicy: isDev ? false : undefined,      // desabilitar CSP em dev (Swagger)
        }));

        // Static assets
        app.useStaticAssets(join(__dirname, '..', 'public'), {
            prefix: '/public/',
        });

        // Global prefix
        app.setGlobalPrefix('api');

        // Validation pipe
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );

        // Swagger documentation (apenas em desenvolvimento)
        if (process.env.NODE_ENV !== 'production') {
            const config = new DocumentBuilder()
                .setTitle('WhatsApp SaaS API')
                .setDescription('API para plataforma multi-WhatsApp com IA')
                .setVersion('1.0')
                .addBearerAuth()
                .build();

            const document = SwaggerModule.createDocument(app, config);
            SwaggerModule.setup('api/docs', app, document);
        }

        // Health check endpoint sem prefixo /api — usado pelo Docker healthcheck
        app.getHttpAdapter().get('/health', (_req: any, res: any) => {
            res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        const port = process.env.PORT || 3000;
        await app.listen(port, '0.0.0.0');

        logger.log(`🚀 Servidor iniciado na porta ${port}`);
        logger.log(`📡 API: http://localhost:${port}/api`);
        if (isDev) logger.log(`📚 Docs: http://localhost:${port}/api/docs`);
    } catch (error) {
        console.error('❌ ERRO CRÍTICO NO BOOTSTRAP DO BACKEND:', error);
        process.exit(1);
    }
}

bootstrap();
