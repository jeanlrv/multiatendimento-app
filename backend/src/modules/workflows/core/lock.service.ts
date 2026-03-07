import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class LockService implements OnModuleInit, OnModuleDestroy {
    private client: Redis;
    private readonly logger = new Logger(LockService.name);

    constructor() {
        // Retry strategy com backoff exponencial — evita crash se Redis demorar a subir
        const retryStrategy = (times: number) => {
            if (times >= 10) return 30000; // após 10 tentativas: 30s entre retries
            return Math.min(500 * Math.pow(2, times - 1), 10000);
        };

        const baseOpts = {
            lazyConnect: true,
            connectTimeout: 10000,
            maxRetriesPerRequest: null,
            retryStrategy,
        };

        const redisUrl = process.env.REDIS_URL;
        this.client = redisUrl
            ? new Redis(redisUrl, baseOpts as any)
            : new Redis({
                ...baseOpts,
                host: process.env.REDISHOST || process.env.REDIS_HOST || 'localhost',
                port: Number(process.env.REDISPORT || process.env.REDIS_PORT) || 6379,
                password: process.env.REDISPASSWORD || process.env.REDIS_PASSWORD || undefined,
            });

        // Logar erros sem derrubar o processo
        this.client.on('error', (err) => this.logger.warn(`Redis LockService: ${err.message}`));
        this.client.on('connect', () => this.logger.log('Redis LockService conectado.'));
    }

    async onModuleInit() {
        // Conecta de forma não-bloqueante: se falhar, ioredis tenta reconectar automaticamente
        this.client.connect().catch((err) => {
            this.logger.warn(`Redis LockService não conectou no boot: ${err.message}. Reconectará automaticamente.`);
        });
    }

    async onModuleDestroy() {
        try { await this.client.quit(); } catch { /* silencioso */ }
    }

    /**
     * Tenta adquirir um lock.
     * @param key Chave do recurso
     * @param ttl Tempo de vida em milissegundos
     * @returns true se adquiriu, false se já existe
     */
    async acquire(key: string, ttl: number): Promise<boolean> {
        const lockKey = `lock:${key}`;
        // SET lockKey 'locked' NX PX ttl
        const result = await (this.client as any).set(lockKey, 'locked', 'NX', 'PX', ttl);
        return result === 'OK';
    }

    /**
     * Libera um lock.
     * @param key Chave do recurso
     */
    async release(key: string): Promise<void> {
        const lockKey = `lock:${key}`;
        await this.client.del(lockKey);
    }

    /**
     * Espera e adquire lock (Spinlock simples com backoff)
     */
    async acquireWithRetry(key: string, ttl: number, retryCount = 10, retryDelay = 500): Promise<boolean> {
        for (let i = 0; i < retryCount; i++) {
            if (await this.acquire(key, ttl)) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        return false;
    }
}
