import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CreateWhatsAppDto } from './dto/create-whatsapp.dto';
import { UpdateWhatsAppDto } from './dto/update-whatsapp.dto';
import { IntegrationsService } from '../settings/integrations.service';
import { CryptoService } from '../../common/services/crypto.service';
import { OnEvent } from '@nestjs/event-emitter';
import { getCircuitBreaker } from '../../common/utils/circuit-breaker';

@Injectable()
export class WhatsAppService {
    private readonly logger = new Logger(WhatsAppService.name);
    private readonly zapiBaseUrl: string;
    /** Circuit breaker isolado por empresa: 5 falhas → circuito OPEN por 30s */
    private readonly zapiCircuitBreaker = getCircuitBreaker('zapi', {
        failureThreshold: 5,
        cooldownMs: 30_000,
        timeoutMs: 15_000,
    });

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
        private integrationsService: IntegrationsService,
        private cryptoService: CryptoService,
    ) {
        // Sanitiza ZAPI_BASE_URL: extrai só a origin para evitar que o usuário cole
        // uma URL de endpoint completa (ex: .../instances/{id}/token/{tok}/send-text)
        const rawUrl = this.configService.get<string>('ZAPI_BASE_URL', 'https://api.z-api.io');
        try {
            this.zapiBaseUrl = new URL(rawUrl).origin;
        } catch {
            this.zapiBaseUrl = 'https://api.z-api.io';
        }
        this.logger.log(`Z-API base URL (sanitized): ${this.zapiBaseUrl}`);
    }

    async findAll(companyId: string) {
        const connections = await this.prisma.whatsAppInstance.findMany({
            where: { companyId },
            include: { department: true },
            orderBy: { createdAt: 'desc' },
        });

        return connections.map(conn => this.maskConnection(conn));
    }

    async findOne(id: string, companyId: string) {
        const connection = await this.prisma.whatsAppInstance.findUnique({
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
        const connection = await this.prisma.whatsAppInstance.findUnique({
            where: { id, companyId },
        });

        if (!connection) {
            throw new NotFoundException('Conexão interna não encontrada');
        }

        return connection;
    }

    private maskConnection(connection: any) {
        const plainToken = connection.zapiToken ? this.cryptoService.decrypt(connection.zapiToken) : null;
        return {
            ...connection,
            zapiToken: plainToken
                ? `${plainToken.substring(0, 4)}${'*'.repeat(Math.min(12, Math.max(4, plainToken.length - 4)))}`
                : null,
            zapiClientToken: connection.zapiClientToken ? '***CONFIGURADO***' : null,
        };
    }

    private async resolveCredentials(connection: any, companyId: string) {
        let instanceId = connection.zapiInstanceId;
        let token = connection.zapiToken ? this.cryptoService.decrypt(connection.zapiToken) : null;
        let clientToken: string | undefined = connection.zapiClientToken
            ? this.cryptoService.decrypt(connection.zapiClientToken)
            : undefined;

        // Fallback granular: preenche apenas os campos ausentes com a config global
        // NUNCA sobrescreve instanceId ou token já definidos na conexão
        if (!instanceId || !token) {
            const globalConfig = await this.integrationsService.findZapiConfig(companyId);
            if (globalConfig) {
                if (!instanceId) instanceId = (globalConfig as any).zapiInstanceId;
                if (!token)      token      = (globalConfig as any).zapiToken;
                if (!clientToken) clientToken = (globalConfig as any).zapiClientToken ?? undefined;
            }
        }

        if (!instanceId) {
            throw new NotFoundException(
                'ID da instância Z-API não configurado. Edite a conexão e preencha o Instance ID.',
            );
        }
        if (!token) {
            throw new NotFoundException(
                'Token Z-API não configurado. Edite a conexão e preencha o Token da Instância.',
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

    /**
     * Wrapper para chamadas POST à Z-API com circuit breaker + timeout integrados.
     * Todas as chamadas de envio devem usar este método em vez de axios.post diretamente.
     */
    private async zapiPost(url: string, data: unknown, clientToken?: string): Promise<any> {
        return this.zapiCircuitBreaker.exec(() =>
            axios.post(url, data, {
                headers: this.buildHeaders(clientToken),
                timeout: 15_000,
            }).then(r => r.data)
        );
    }

    async create(createWhatsAppDto: CreateWhatsAppDto, companyId: string) {
        const { departmentIds = [], ...data } = createWhatsAppDto as any;
        // Usa o primeiro departamento selecionado como departmentId (FK legada para roteamento)
        const primaryDeptId = departmentIds.length > 0 ? departmentIds[0] : undefined;

        const connection = await this.prisma.whatsAppInstance.create({
            data: {
                ...data,
                zapiToken: data.zapiToken ? this.cryptoService.encrypt(data.zapiToken) : undefined,
                zapiClientToken: data.zapiClientToken ? this.cryptoService.encrypt(data.zapiClientToken) : undefined,
                companyId,
                status: 'DISCONNECTED',
                isActive: true,
                departmentIds,
                departmentId: primaryDeptId,
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
        const { departmentIds, ...data } = updateWhatsAppDto as any;

        const updateData: any = { ...data };
        if (departmentIds !== undefined) {
            // Sincroniza departmentId (FK legada) com o primeiro do array
            updateData.departmentIds = departmentIds;
            updateData.departmentId = departmentIds.length > 0 ? departmentIds[0] : null;
        }
        // Criptografar tokens ao atualizar; string vazia = limpar o campo (null)
        if (updateData.zapiToken) updateData.zapiToken = this.cryptoService.encrypt(updateData.zapiToken);
        if (updateData.zapiClientToken === '') {
            updateData.zapiClientToken = null; // limpar token de segurança
        } else if (updateData.zapiClientToken) {
            updateData.zapiClientToken = this.cryptoService.encrypt(updateData.zapiClientToken);
        }

        return this.prisma.whatsAppInstance.update({
            where: { id },
            data: updateData,
            include: { department: true },
        });
    }

    async remove(id: string, companyId: string) {
        await this.findOne(id, companyId);
        return this.prisma.whatsAppInstance.delete({ where: { id } });
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

            const data = response.data;
            this.logger.debug(`Z-API /status response [${instanceId}]: connected=${data?.connected ?? data?.value}, status=${data?.status}`);

            // Z-API pode retornar connected como boolean, número ou string
            // Também pode envolver em data.value (padrão de alguns endpoints Z-API)
            const raw = data?.value ?? data?.connected ?? data?.status ?? data;
            const isConnected =
                raw === true || raw === 1 || raw === 'connected' || raw === 'CONNECTED' ||
                (typeof raw === 'object' && (raw?.connected === true || raw?.connected === 1));

            const newStatus = isConnected ? 'CONNECTED' : 'DISCONNECTED';

            // Sincronizar status com o banco de dados
            await this.prisma.whatsAppInstance.update({
                where: { id },
                data: { status: newStatus },
            });

            return {
                connected: isConnected,
                smartphoneConnected: data.smartphoneConnected ?? null,
                error: data.error || null,
                status: newStatus,
                _raw: data,   // expõe resposta bruta para debug no frontend
            };
        } catch (error: any) {
            this.logger.error(`Erro ao verificar status na Z-API [${instanceId}]: ${error.message} (HTTP ${error.response?.status ?? 'N/A'})`);
            return { connected: false, status: 'ERROR', error: error.message, _raw: error.response?.data };
        }
    }

    /**
     * Registra automaticamente a URL de webhook na Z-API (PUT /update-every-webhooks).
     * Requer a variável de ambiente BACKEND_PUBLIC_URL configurada.
     */
    async registerWebhook(connectionId: string, companyId: string) {
        const backendUrl = this.configService.get<string>('BACKEND_PUBLIC_URL', '');
        if (!backendUrl) {
            throw new BadRequestException('BACKEND_PUBLIC_URL não configurado. Adicione esta variável de ambiente no servidor.');
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
        return { ok: true, webhookUrl, instanceId };
    }

    async sendMessage(connectionId: string, phoneNumber: string, message: string, companyId: string) {
        const connection = await this.getInternal(connectionId, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);
        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/send-text`;
        try {
            const data = await this.zapiPost(url, { phone: phoneNumber, message }, clientToken);
            this.logger.log(`Mensagem enviada para ${phoneNumber} via ${instanceId}`);
            return data;
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
            return await this.zapiPost(url, { phone: phoneNumber, image: imageUrl, caption }, clientToken);
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
            return await this.zapiPost(url, { phone: phoneNumber, audio: audioUrl }, clientToken);
        } catch (error) {
            this.logger.error(`Erro ao enviar áudio via Z-API: ${error.message}`);
            throw error;
        }
    }

    async sendPttAudio(connectionId: string, phoneNumber: string, audioUrl: string, companyId: string) {
        const connection = await this.getInternal(connectionId, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);
        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/send-ptt-audio`;
        try {
            return await this.zapiPost(url, { phone: phoneNumber, audio: audioUrl }, clientToken);
        } catch (error) {
            this.logger.error(`Erro ao enviar PTT áudio via Z-API: ${error.message}`);
            throw error;
        }
    }

    async sendDocument(connectionId: string, phoneNumber: string, documentUrl: string, fileName: string, extension: string, companyId: string) {
        const connection = await this.getInternal(connectionId, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);
        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/send-document/${extension}`;
        try {
            return await this.zapiPost(url, { phone: phoneNumber, document: documentUrl, fileName }, clientToken);
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
            return await this.zapiPost(url, { phone: phoneNumber, video: videoUrl, caption }, clientToken);
        } catch (error) {
            this.logger.error(`Erro ao enviar vídeo via Z-API: ${error.message}`);
            throw error;
        }
    }

    @OnEvent('csat.pending')
    async handleCsatPending(payload: { companyId: string; ticketId: string; connectionId: string; phoneNumber: string; message: string }) {
        try {
            await this.sendMessage(payload.connectionId, payload.phoneNumber, payload.message, payload.companyId);
            this.logger.log(`CSAT enviado para ${payload.phoneNumber} (ticket ${payload.ticketId})`);
        } catch (error) {
            this.logger.error(`Falha ao enviar CSAT para ticket ${payload.ticketId}: ${error.message}`);
        }
    }

    @OnEvent('ticket.expired')
    async handleTicketExpired(payload: { ticketId: string; companyId: string; connectionId: string; phoneNumber: string; message: string }) {
        try {
            await this.sendMessage(payload.connectionId, payload.phoneNumber, payload.message, payload.companyId);
            this.logger.log(`[TicketExpired] Mensagem enviada para ${payload.phoneNumber} (ticket ${payload.ticketId})`);
        } catch (error) {
            this.logger.error(`[TicketExpired] Falha ao enviar mensagem: ${error.message}`);
        }
    }

    // ─── Read Receipts & Presence ──────────────────────────────────────────────

    /**
     * Envia confirmação de leitura para o WhatsApp via Z-API.
     * Endpoint: POST /instances/{id}/token/{tok}/read-message
     */
    async sendReadReceipt(connectionId: string, phoneNumber: string, messageId: string, companyId: string) {
        const connection = await this.getInternal(connectionId, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);

        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/read-message`;

        try {
            await axios.post(
                url,
                { phone: phoneNumber, messageId },
                { headers: this.buildHeaders(clientToken) },
            );
            this.logger.debug(`Read receipt enviado para ${phoneNumber} (msg: ${messageId})`);
        } catch (error) {
            this.logger.debug(`Falha ao enviar read receipt: ${error.message}`);
        }
    }

    /**
     * Envia presença (digitando/parado) para o WhatsApp via Z-API.
     * Endpoint: POST /instances/{id}/token/{tok}/send-presence
     */
    async sendPresence(connectionId: string, phoneNumber: string, composing: boolean, companyId: string) {
        const connection = await this.getInternal(connectionId, companyId);
        const { instanceId, token, clientToken } = await this.resolveCredentials(connection, companyId);

        const url = `${this.zapiBaseUrl}/instances/${instanceId}/token/${token}/send-presence`;

        try {
            await axios.post(
                url,
                { phone: phoneNumber, presence: composing ? 'composing' : 'paused' },
                { headers: this.buildHeaders(clientToken) },
            );
        } catch (error) {
            this.logger.debug(`Falha ao enviar presença: ${error.message}`);
        }
    }

    /**
     * Listener: quando agente digita no chat, envia presença ao WhatsApp.
     * Rate-limited pelo gateway (2s entre eventos).
     */
    @OnEvent('whatsapp.presence')
    async handleWhatsAppPresence(payload: { ticketId: string; composing: boolean }) {
        try {
            const ticket = await this.prisma.ticket.findUnique({
                where: { id: payload.ticketId },
                include: { contact: true },
            });
            if (!ticket?.connectionId || !ticket?.contact?.phoneNumber) return;

            await this.sendPresence(
                ticket.connectionId,
                ticket.contact.phoneNumber,
                payload.composing,
                ticket.companyId,
            );
        } catch (error) {
            this.logger.debug(`[Presence] Erro ao processar presença: ${error.message}`);
        }
    }
}
