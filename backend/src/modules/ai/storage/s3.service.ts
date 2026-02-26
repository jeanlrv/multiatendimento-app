import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
    private readonly logger = new Logger(S3Service.name);
    private s3Client: S3Client;
    private bucketName: string;

    constructor(private configService: ConfigService) {
        this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');

        // Inicializar cliente S3 apenas se as variáveis de ambiente estiverem configuradas
        if (this.configService.get<string>('AWS_ACCESS_KEY_ID') &&
            this.configService.get<string>('AWS_SECRET_ACCESS_KEY')) {
            this.s3Client = new S3Client({
                region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
                credentials: {
                    accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
                    secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
                },
            });
        }
    }

    /**
     * Faz upload de um buffer para o S3
     */
    async uploadBuffer(buffer: Buffer, filename: string, contentType?: string): Promise<string> {
        if (!this.s3Client) {
            throw new Error('Serviço S3 não configurado. Verifique as variáveis de ambiente.');
        }

        try {
            const key = `ai-documents/${randomUUID()}-${filename}`;

            const upload = new Upload({
                client: this.s3Client,
                params: {
                    Bucket: this.bucketName,
                    Key: key,
                    Body: buffer,
                    ContentType: contentType || 'application/octet-stream',
                },
            });

            await upload.done();
            return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
        } catch (error) {
            this.logger.error(`Erro ao fazer upload para S3: ${error.message}`);
            throw error;
        }
    }

    /**
     * Faz upload de um arquivo do sistema de arquivos para o S3
     */
    async uploadFile(filePath: string, filename: string, contentType?: string): Promise<string> {
        if (!this.s3Client) {
            throw new Error('Serviço S3 não configurado. Verifique as variáveis de ambiente.');
        }

        try {
            const fs = require('fs');
            const buffer = fs.readFileSync(filePath);
            return await this.uploadBuffer(buffer, filename, contentType);
        } catch (error) {
            this.logger.error(`Erro ao ler arquivo e fazer upload para S3: ${error.message}`);
            throw error;
        }
    }

    /**
     * Remove um arquivo do S3
     */
    async deleteFile(url: string): Promise<void> {
        if (!this.s3Client) {
            this.logger.warn('Serviço S3 não configurado. Não foi possível remover arquivo.');
            return;
        }

        try {
            // Extrair key da URL
            const key = url.replace(`https://${this.bucketName}.s3.amazonaws.com/`, '');

            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            await this.s3Client.send(command);
        } catch (error) {
            this.logger.error(`Erro ao remover arquivo do S3: ${error.message}`);
            throw error;
        }
    }
}