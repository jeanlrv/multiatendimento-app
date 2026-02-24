import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CreateWhatsAppDto } from './dto/create-whatsapp.dto';
import { UpdateWhatsAppDto } from './dto/update-whatsapp.dto';
import { IntegrationsService } from '../settings/integrations.service';

@Injectable()
export class WhatsAppService {
    private readonly logger = new Logger(WhatsAppService.name);
    private readonly zapiBaseUrl: string;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        private integrationsService: IntegrationsService,
    ) {
        this.zapiBaseUrl = this.configService.get<string>('ZAPI_BASE_URL', 'https://api.z-api.io');
    }

    async findAll(companyId: string) {
        const connections = await (this.prisma as any).whatsAppInstance.findMany({
            where: { companyId },
            include: { department: true },
            orderBy: { createdAt: 'desc' },
        });

        return connections.map(conn => this.maskConnection(conn));
    }

    async findOne(id: string, companyId: string) {
        const connection = await (this.prisma as any).whatsAppInstance.findUnique({
            where: { id, companyId },
            include: { department: true },
        });

        if (!connection) {
            throw new NotFoundException('Conexão não encontrada nesta empresa');
        }

        return this.maskConnection(connection);
    }

    // Método para uso interno (envio de mensagens, etc) sem máscara
    async getInternal(id: string, companyId: string) {
        const connection = await (this.prisma as any).whatsAppInstance.findUnique({
            where: { id, companyId },
        });

        if (!connection) {
            throw new NotFoundException('Conexão interna não encontrada');
        }

        return connection;
    }

    private maskConnection(connection: any) {
        return {
            ...connection,
            zapiToken: connection.zapiToken
                ? `${connection.zapiToken.substring(0, 4)}${'*'.repeat(Math.min(12, Math.max(4, connection.zapiToken.length - 4)))}`
                : null,
            zapiClientToken: connection.zapiClientToken ? '***CONFIGURADO***' : null,
        };
    }

    private async resolveCredentials(connection: any, companyId: string) {
        let instanceId = connection.zapiInstanceId;
        let token = connection.zapiToken;
        let clientToken: string | undefined;

        // Se não houver chaves na conexão, busca o provedor global da empresa
        if (!instanceId || !token) {
            const globalConfig = await this.integrationsService.findZapiConfig(companyId);
            if (globalConfig) {
                instanceId = (globalConfig as any).zapiInstanceId;
                token = (globalConfig as any).zapiToken;
                clientToken = (globalConfig as any).zapiClientToken ?? undefined;
            }
        }

        if (!instanceId || !token) {
            throw new NotFoundException(
                'Credenciais Z-API não encontradas. Configure em Configurações → Integrações.',
            );
        }

        return { instanceId, token, clientToken };
    }

    /**
     * Monta headers padrão para todas as requisições Z-API.
     * Client-Token é obrigatório quando ativado em Security na conta Z-API.
     */
    private buildHeaders(clientToken?: string): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (clientToken) {
            headers['Client-Token'] = clientToken;
        }
        return headers;
    }

    async create(createWhatsAppDto: CreateWhatsAppDto, companyId: string) {
        const { departmentId, ...data } = createWhatsAppDto as any;

        const connection = await (this.prisma as any).whatsAppInstance.create({
            data: {
                ...data,
                companyId,
                status: 'DISCONNECTED',
                isActive: true,
                departmentId: departmentId || undefined,
            },
            include: { department: true },
        });

        // Tenta registrar o webhook automaticamente na Z-API
        await this.registerWebhook(connection.id, companyId).catch(err =>
            this.logger.warn(`Não foi possível registrar webhook automaticamente: ${err.message}`),
        );

        return connection;
    }

    async update(id: string, updateWhatsAppDto: UpdateWhatsAppDto, companyId: string) {
        await this.findOne(id, companyId);
        const { departmentId, ...data } = updateWhatsAppDto as any;

        return (this.prisma as any).whatsAppInstance.update({
            where: { id },
            data: {
                ...data,
                departmentId: departmentId || undefined,
            },
            include: { department: true },
        });
    }

    async remove(id: string, companyId: string) {
        await this.findOne(id, companyId);
        return (this.prisma as any).whatsAppInstance.delete({ where: { id } });
    }

    async getQrCode(id: string, companyId: string) {
        const connection = await this.getInternal(id, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);

        // Usar /qr-code/image para receber a imagem em base64 (exibição direta no frontend)
        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/qr-code/image`;

        try {
            this.logger.log(`Solicitando QR Code na Z-API: ${instanceId}`);
            const response = await axios.get(url, {
                headers: this.buildHeaders(clientToken),
            });

            // Z-API retorna { value: "base64string" } para /qr-code/image
            const qrcode = response.data.value || response.data.qrcode || response.data.qrCode;

            return {
                qrcode,
                status: response.data.connected ? 'CONNECTED' : 'WAITING_SCAN',
                instanceId,
            };
        } catch (error) {
            this.logger.error(`Erro ao buscar QR Code: ${error.message}`);
            return {
                qrcode: null,
                status: 'ERROR',
                error: 'Verifique as credenciais Z-API em Configurações → Integrações.',
                instanceId,
            };
        }
    }

    async checkStatus(id: string, companyId: string) {
        const connection = await this.getInternal(id, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);

        // Endpoint correto da Z-API: /status (não /status-instance)
        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/status`;

        try {
            const response = await axios.get(url, {
                headers: this.buildHeaders(clientToken),
            });

            const isConnected = response.data.connected === true;
            const newStatus = isConnected ? 'CONNECTED' : 'DISCONNECTED';

            // Sincronizar status com o banco de dados
            await (this.prisma as any).whatsAppInstance.update({
                where: { id },
                data: { status: newStatus },
            });

            return {
                connected: isConnected,
                smartphoneConnected: response.data.smartphoneConnected ?? null,
                error: response.data.error || null,
                status: newStatus,
            };
        } catch (error) {
            this.logger.error(`Erro ao verificar status na Z-API: ${error.message}`);
            return { connected: false, status: 'ERROR', error: error.message };
        }
    }

    /**
     * Registra automaticamente a URL de webhook na Z-API (PUT /update-every-webhooks).
     * Requer a variável de ambiente BACKEND_PUBLIC_URL configurada.
     */
    async registerWebhook(connectionId: string, companyId: string) {
        const backendUrl = this.configService.get<string>('BACKEND_PUBLIC_URL', '');
        if (!backendUrl) {
            this.logger.warn('BACKEND_PUBLIC_URL não configurado — webhook não registrado na Z-API.');
            return;
        }

        const connection = await this.getInternal(connectionId, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);

        const webhookUrl = `${backendUrl}/api/webhooks/zapi`;
        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/update-every-webhooks`;

        const response = await axios.put(
            url,
            { value: webhookUrl },
            { headers: this.buildHeaders(clientToken) },
        );

        this.logger.log(`Webhook registrado na Z-API [${instanceId}]: ${webhookUrl}`);
        return response.data;
    }

    async sendMessage(connectionId: string, phoneNumber: string, message: string, companyId: string) {
        const connection = await this.getInternal(connectionId, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);

        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/send-text`;

        try {
            const response = await axios.post(
                url,
                { phone: phoneNumber, message },
                { headers: this.buildHeaders(clientToken) },
            );
            this.logger.log(`Mensagem enviada para ${phoneNumber} via ${instanceId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Erro ao enviar mensagem via Z-API: ${error.message}`);
            throw error;
        }
    }

    async sendImage(connectionId: string, phoneNumber: string, imageUrl: string, companyId: string, caption?: string) {
        const connection = await this.getInternal(connectionId, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);

        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/send-image`;

        try {
            const response = await axios.post(
                url,
                { phone: phoneNumber, image: imageUrl, caption },
                { headers: this.buildHeaders(clientToken) },
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Erro ao enviar imagem via Z-API: ${error.message}`);
            throw error;
        }
    }

    async sendAudio(connectionId: string, phoneNumber: string, audioUrl: string, companyId: string) {
        const connection = await this.getInternal(connectionId, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);

        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/send-audio`;

        try {
            const response = await axios.post(
                url,
                { phone: phoneNumber, audio: audioUrl },
                { headers: this.buildHeaders(clientToken) },
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Erro ao enviar áudio via Z-API: ${error.message}`);
            throw error;
        }
    }

    async sendDocument(connectionId: string, phoneNumber: string, documentUrl: string, fileName: string, extension: string, companyId: string) {
        const connection = await this.getInternal(connectionId, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);

        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/send-document/${extension}`;

        try {
            const response = await axios.post(
                url,
                { phone: phoneNumber, document: documentUrl, fileName },
                { headers: this.buildHeaders(clientToken) },
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Erro ao enviar documento via Z-API: ${error.message}`);
            throw error;
        }
    }

    async sendVideo(connectionId: string, phoneNumber: string, videoUrl: string, companyId: string, caption?: string) {
        const connection = await this.getInternal(connectionId, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);

        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/send-video`;

        try {
            const response = await axios.post(
                url,
                { phone: phoneNumber, video: videoUrl, caption },
                { headers: this.buildHeaders(clientToken) },
            );
            return response.data;
        } catch (error) {
            this.logger.error(`Erro ao enviar vídeo via Z-API: ${error.message}`);
            throw error;
        }
    }
}
