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
        console.warn(`\n⚠️  AVISO: Variáveis de ambiente JWT não definidas: ${missing.join(', ')}`);
        console.warn('   Usando valores temporários inseguros para permitir inicialização (Troque-os!)');
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'fallback-unsafe-secret-key-at-least-32-chars-long';
        process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-unsafe-refresh-secret-key-at-least-32-chars-long';
    }
    if (process.env.JWT_SECRET?.includes('change-in-production') || process.env.JWT_REFRESH_SECRET?.includes('change-in-production')) {
        console.warn('\n⚠️  AVISO: JWT_SECRET ainda usa o valor padrão inseguro. Defina um segredo forte.\n');
    }
    const MIN_SECRET_LENGTH = 32;
    if ((process.env.JWT_SECRET?.length ?? 0) < MIN_SECRET_LENGTH) {
        console.warn(`\n⚠️  AVISO: JWT_SECRET é muito curto (mínimo ${MIN_SECRET_LENGTH}). Use uma chave mais forte.\n`);
    }
    if ((process.env.JWT_REFRESH_SECRET?.length ?? 0) < MIN_SECRET_LENGTH) {
        console.warn(`\n⚠️  AVISO: JWT_REFRESH_SECRET é muito curto (mínimo ${MIN_SECRET_LENGTH}). Use uma chave mais forte.\n`);
    }
    if (!process.env.ENCRYPTION_KEY) {
        console.warn('\n⚠️  AVISO: ENCRYPTION_KEY não configurado — tokens armazenados em plaintext no banco.\n');
    } else if ((process.env.ENCRYPTION_KEY.length) < MIN_SECRET_LENGTH) {
        console.warn(`\n⚠️  AVISO: ENCRYPTION_KEY tem menos de ${MIN_SECRET_LENGTH} caracteres — recomendado usar openssl rand -hex 32.\n`);
    }
}

async function bootstrap() {
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
}

bootstrap();
