import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response, NextFunction } from 'express';
import { join } from 'path';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as Sentry from '@sentry/node';
import { WinstonLogger } from './common/logger/winston.logger';

// Inicializar Sentry antes de tudo (captura erros do bootstrap também)
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
        // Remove dados sensíveis de autenticação antes de enviar ao Sentry (LGPD)
        beforeSend(event) {
            if (event.request?.cookies) delete event.request.cookies;
            if (event.request?.headers?.cookie) delete event.request.headers.cookie;
            if (event.request?.headers?.authorization) delete event.request.headers.authorization;
            return event;
        },
    });
}

process.on('uncaughtException', (err) => {
    if (process.env.SENTRY_DSN) Sentry.captureException(err);
    console.error('❌ FATAL: Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
    if (process.env.SENTRY_DSN) Sentry.captureException(reason);
    console.error('❌ FATAL: Unhandled Rejection:', reason instanceof Error ? reason.message : reason);
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
        const winstonLogger = new WinstonLogger('Bootstrap');
        const isDev = process.env.NODE_ENV !== 'production';
        const allowedOrigins = process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
            : isDev
                ? '*'
                : [];

        // Criamos o app SEM cors para poder registrar embed CORS antes do global
        const app = await NestFactory.create<NestExpressApplication>(AppModule, {
            logger: new WinstonLogger(),
        });

        // Cookie parser — necessário para ler httpOnly cookies nos guards e controllers
        app.use(cookieParser());

        // ── CORS para Embed (deve ser PRIMEIRO, antes do enableCors global) ──────
        // Preflight OPTIONS de sites externos chega aqui ANTES do global CORS,
        // garantindo que 'Access-Control-Allow-Origin: *' seja enviado corretamente.
        app.use('/api/embed', (req: Request, res: Response, next: NextFunction) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin, Accept');
            if (req.method === 'OPTIONS') {
                return res.status(204).end();
            }
            next();
        });

        // ── CORS global para rotas autenticadas ─────────────────────────────────
        app.enableCors({
            origin: allowedOrigins,
            credentials: true,
        });

        // Graceful shutdown — aguarda requests em andamento antes de encerrar
        app.enableShutdownHooks();

        // Helmet — headers de segurança HTTP adicionais (complementa os do nginx)
        app.use(helmet({
            crossOriginResourcePolicy: { policy: 'cross-origin' }, // permite static assets
            contentSecurityPolicy: isDev ? false : {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],       // webhooks/embed JS inline necessário
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", 'data:', 'blob:', '*'],       // upload previews e avatares externos
                    connectSrc: ["'self'", 'wss:', 'https:'],        // WebSocket + APIs externas
                    fontSrc: ["'self'", 'data:'],
                    objectSrc: ["'none'"],
                    frameSrc: ["'none'"],
                    upgradeInsecureRequests: [],
                },
            },
        }));

        // Static assets
        app.useStaticAssets(join(__dirname, '..', 'public'), {
            prefix: '/public/',
        });

        // Global prefix
        app.setGlobalPrefix('api');

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
        app.getHttpAdapter().get('/health', (_req: Request, res: Response) => {
            res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        const port = process.env.PORT || 3000;

        // Railway requer binding em 0.0.0.0 para acessibilidade pública e privada
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
