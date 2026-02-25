import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class LockService implements OnModuleInit, OnModuleDestroy {
    private client: Redis;
    private readonly logger = new Logger(LockService.name);

    constructor() {
        const redisOptions = process.env.REDIS_URL
            ? process.env.REDIS_URL
            : {
                host: process.env.REDISHOST || process.env.REDIS_HOST || 'localhost',
                port: Number(process.env.REDISPORT || process.env.REDIS_PORT) || 6379,
                password: process.env.REDISPASSWORD || process.env.REDIS_PASSWORD || undefined,
            };

        this.client = typeof redisOptions === 'string'
            ? new Redis(redisOptions, { lazyConnect: true })
            : new Redis({ ...redisOptions, lazyConnect: true });

        this.client.on('error', (err) => this.logger.error('Redis LockService Error', err));
    }

    async onModuleInit() {
        await this.client.connect();
    }

    async onModuleDestroy() {
        await this.client.quit();
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
