import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { PrismaService } from '../../../database/prisma.service';

/**
 * Serviço de cache de embeddings para otimizar o processamento de documentos.
 * Armazena embeddings de chunks já processados para evitar recálculo.
 */
@Injectable()
export class EmbeddingCacheService implements OnModuleInit {
    private readonly logger = new Logger(EmbeddingCacheService.name);

    // Cache em memória para acesso rápido
    private memoryCache = new Map<string, {
        embedding: number[];
        chunkId: string;
        documentId: string;
        knowledgeBaseId: string;
        createdAt: Date;
    }>();

    // TTL do cache em memória (1 hora)
    private readonly MEMORY_CACHE_TTL = 60 * 60 * 1000;

    // Limite de entradas no cache de memória
    private readonly MEMORY_CACHE_LIMIT = 1000;

    constructor(
        private prisma: PrismaService,
        @InjectQueue('knowledge-processing') private knowledgeQueue: Queue,
    ) { }

    async onModuleInit() {
        this.logger.log('EmbeddingCacheService inicializado');

        // Limpar cache expirado a cada 10 minutos
        setInterval(() => this.cleanupExpiredCache(), 10 * 60 * 1000);
    }

    /**
     * Verifica se um embedding já está em cache
     */
    async getFromCache(chunkId: string): Promise<number[] | null> {
        const cached = this.memoryCache.get(chunkId);

        if (!cached) {
            return null;
        }

        // Verificar se o cache expirou
        if (Date.now() - cached.createdAt.getTime() > this.MEMORY_CACHE_TTL) {
            this.memoryCache.delete(chunkId);
            return null;
        }

        return cached.embedding;
    }

    /**
     * Adiciona um embedding ao cache
     */
    addToCache(chunkId: string, embedding: number[], documentId: string, knowledgeBaseId: string) {
        // Se o cache estiver cheio, remover entradas mais antigas
        if (this.memoryCache.size >= this.MEMORY_CACHE_LIMIT) {
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
        }

        this.memoryCache.set(chunkId, {
            embedding,
            chunkId,
            documentId,
            knowledgeBaseId,
            createdAt: new Date(),
        });
    }

    /**
     * Verifica se um chunk já foi processado (usando hash do conteúdo)
     */
    async isChunkProcessed(contentHash: string): Promise<boolean> {
        // Verificar no banco de dados
        const existingChunk = await (this.prisma as any).documentChunk.findFirst({
            where: {
                contentHash,
            },
            select: { id: true },
        });

        return !!existingChunk;
    }

    /**
     * Obtém embeddings duplicados para evitar recálculo
     */
    async findDuplicateChunks(contentHash: string, knowledgeBaseId: string) {
        const chunks = await (this.prisma as any).documentChunk.findMany({
            where: {
                contentHash,
                knowledgeBaseId,
            },
            include: {
                document: {
                    include: {
                        knowledgeBase: true,
                    },
                },
            },
            take: 10,
        });

        return chunks;
    }

    /**
     * Limpa entradas expiradas do cache
     */
    private cleanupExpiredCache() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, value] of this.memoryCache.entries()) {
            if (now - value.createdAt.getTime() > this.MEMORY_CACHE_TTL) {
                this.memoryCache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.logger.log(`Cache limpo: ${cleaned} entradas expiradas removidas`);
        }
    }

    /**
     * Limpa todo o cache
     */
    clearCache() {
        const size = this.memoryCache.size;
        this.memoryCache.clear();
        this.logger.log(`Cache limpo: ${size} entradas removidas`);
    }

    /**
     * Obtém estatísticas do cache
     */
    getCacheStats() {
        return {
            size: this.memoryCache.size,
            limit: this.MEMORY_CACHE_LIMIT,
            ttl: this.MEMORY_CACHE_TTL / 1000, // em segundos
        };
    }

    /**
     * Remove um chunk específico do cache
     */
    removeFromCache(chunkId: string) {
        this.memoryCache.delete(chunkId);
    }

    /**
     * Remove todos os chunks de um documento do cache
     */
    removeFromDocument(documentId: string) {
        let removed = 0;
        for (const [key, value] of this.memoryCache.entries()) {
            if (value.documentId === documentId) {
                this.memoryCache.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            this.logger.log(`Removidos ${removed} chunks do cache para o documento ${documentId}`);
        }
    }
}