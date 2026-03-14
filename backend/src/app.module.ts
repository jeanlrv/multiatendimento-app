import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { ChatModule } from './modules/chat/chat.module';
import { AIModule } from './modules/ai/ai.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { TagsModule } from './modules/tags/tags.module';
import { AuditModule } from './modules/audit/audit.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettingsModule } from './modules/settings/settings.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { RolesModule } from './modules/roles/roles.module';
import { MailModule } from './modules/mail/mail.module';
import { MulterModule } from '@nestjs/platform-express';
import { ServeStaticModule } from '@nestjs/serve-static';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { join } from 'path';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { SavedFiltersModule } from './modules/saved-filters/saved-filters.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CryptoModule } from './common/crypto.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { TenantGuard } from './modules/auth/guards/tenant.guard';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard';
import { QuickRepliesModule } from './modules/quick-replies/quick-replies.module';
import { SearchModule } from './modules/search/search.module';
import { BroadcastModule } from './modules/broadcast/broadcast.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        ThrottlerModule.forRoot([
            {
                name: 'default',
                ttl: 60000,   // janela de 1 minuto
                limit: 120,   // 120 req/min por IP (geral)
            },
            {
                name: 'strict',
                ttl: 60000,
                limit: 10,    // 10 req/min (login, refresh)
            },
        ]),
        EventEmitterModule.forRoot(),
        BullModule.forRootAsync({
            useFactory: () => {
                const redisUrl = process.env.REDIS_URL;
                const host = process.env.REDISHOST || process.env.REDIS_HOST || 'localhost';
                const port = parseInt(process.env.REDISPORT || process.env.REDIS_PORT || '6379', 10);
                const password = process.env.REDISPASSWORD || process.env.REDIS_PASSWORD || undefined;

                console.log(`🔍 [Redis Config] URL: ${redisUrl ? redisUrl.replace(/:\/\/[^@]*@/, '://***@') : 'N/A'}, Host: ${host}, Port: ${port}, HasPassword: ${!!password}`);

                // Retry strategy com backoff exponencial — evita spam no log quando Redis está fora
                const retryStrategy = (times: number) => {
                    if (times >= 10) {
                        // Após 10 tentativas, backoff longo (30s) para evitar spam
                        return 30000;
                    }
                    // Backoff exponencial: 500ms, 1s, 2s, 4s, 8s, 16s... cap em 10s
                    return Math.min(500 * Math.pow(2, times - 1), 10000);
                };

                const baseConnectionOptions = {
                    connectTimeout: 35000,      // 35s — fastembed bloqueia event loop ~20s no boot
                    maxRetriesPerRequest: null,  // BullMQ requer null (sem limite por request)
                    enableOfflineQueue: true,    // Fila offline habilitada (BullMQ precisa)
                    retryStrategy,
                    lazyConnect: false,
                };

                const connection = (() => {
                    if (redisUrl) {
                        try {
                            const parsed = new URL(redisUrl);
                            const isTls = parsed.protocol === 'rediss:';
                            return {
                                ...baseConnectionOptions,
                                host: parsed.hostname,
                                port: parseInt(parsed.port, 10) || 6379,
                                password: parsed.password || undefined,
                                username: parsed.username || undefined,
                                ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
                            };
                        } catch (e) {
                            console.error('❌ [Redis Config] Erro ao parsear REDIS_URL:', e.message);
                        }
                    }
                    return {
                        ...baseConnectionOptions,
                        host,
                        port,
                        password,
                    };
                })();

                return { connection };
            },
        }),
        DatabaseModule,
        UsersModule,
        AuthModule,
        DepartmentsModule,
        WhatsAppModule,
        TicketsModule,
        ChatModule,
        AIModule,
        EvaluationsModule,
        ContactsModule,
        TagsModule,
        AuditModule,
        UploadsModule,
        DashboardModule,
        NotificationsModule,
        SettingsModule,
        WorkflowsModule,
        RolesModule,
        MailModule,
        SchedulingModule,
        CompaniesModule,
        CollaborationModule,
        SavedFiltersModule,
        ReportsModule,
        CryptoModule,
        MulterModule.register({
            dest: './public/uploads',
        }),
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'public'),
            serveRoot: '/public',
        }),
        QuickRepliesModule,
        SearchModule,
        BroadcastModule,
    ],
    controllers: [],
    providers: [
        // ThrottlerGuard primeiro — limita por IP antes de qualquer autenticação
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: TenantGuard,
        },
        {
            provide: APP_GUARD,
            useClass: PermissionsGuard,
        },
    ],
})
export class AppModule { }
