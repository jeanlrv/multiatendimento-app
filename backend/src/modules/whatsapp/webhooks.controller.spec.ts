import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhookProcessingService } from './webhook-processing.service';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../../database/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { LockService } from '../workflows/core/lock.service';

describe('WebhooksController (Integração)', () => {
    let webhooksController: WebhooksController;
    let bullQueueMock: any;
    let cryptoServiceMock: any;
    let prismaServiceMock: any;

    beforeEach(async () => {
        // Mock de dependências externas (BullMQ)
        bullQueueMock = {
            add: jest.fn().mockResolvedValue({ id: 'job-123' }),
        };

        // Mock do Banco de Dados
        prismaServiceMock = {
            whatsAppInstance: {
                findUnique: jest.fn(),
            },
            integration: {
                findFirst: jest.fn(),
            }
        };

        // Mock de criptografia para lidar com os tokens hasheados no BD
        cryptoServiceMock = {
            decrypt: jest.fn().mockImplementation((encrypted) => {
                if (encrypted === 'enc:token_secreto_valido') return 't0k3n_v4l1d0';
                return 'invalid';
            })
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [WebhooksController],
            providers: [
                WebhookProcessingService,
                { provide: getQueueToken('webhooks-incoming'), useValue: bullQueueMock },
                { provide: PrismaService, useValue: prismaServiceMock },
                { provide: CryptoService, useValue: cryptoServiceMock },
                // Mock dependencies to allow WebhookProcessingService instantiation
                { provide: ChatService, useValue: {} },
                { provide: ChatGateway, useValue: {} },
                { provide: EventEmitter2, useValue: {} },
                { provide: LockService, useValue: {} },
            ],
        }).compile();

        webhooksController = module.get<WebhooksController>(WebhooksController);
        jest.clearAllMocks();
    });

    // Objetivo: Garantir o fluxo de Rejeição de Segurança logo na borda, protegendo o sistema.
    describe('Validação de Segurança (InstanceId nulo)', () => {
        it('deve_rejeitar_webhook_quando_instance_id_estiver_vazio', async () => {
            // Contexto: A Z-API tenta enviar um payload malformado ou ataque sem a field de roteamento
            const payloadSemInstance = {
                type: 'Message',
                phone: '123456',
                clientToken: 'algum-token',
                // instanceId undefined/vazio
            };

            const result = await webhooksController.handleZApiWebhook(payloadSemInstance as any);

            // Validação de WHAT (O que ela faz):
            // Não deve enfileirar nada e deve devolver `{ success: false }` informando o erro.
            expect(result).toHaveProperty('success', false);
            expect(result).toHaveProperty('error', 'instanceId obrigatório');
            expect(bullQueueMock.add).not.toHaveBeenCalled();
        });
    });

    // Objetivo: Garantir validação Timing-Safe de Tokens entre Banco e Request
    describe('Validação de Tokens Client/ZApi', () => {
        it('deve_retornar_erro_quando_token_de_seguranca_for_invalido', async () => {
            // Estado inicial: Banco de dados possui uma instância WhatsApp com um token de segurança configurado (hash criptográfico)
            prismaServiceMock.whatsAppInstance.findUnique.mockResolvedValueOnce({
                id: 'inst-123',
                zapiInstanceId: 'inst-123',
                zapiClientToken: 'enc:token_secreto_valido'
            });

            // Contexto: O Request da Z-API vem com um token que não bate na descriptografia (t0k3n_hack34do)
            const payloadAtaque = {
                instanceId: 'inst-123',
                type: 'Message',
                clientToken: 't0k3n_hack34do'
            };

            const result = await webhooksController.handleZApiWebhook(payloadAtaque as any);

            // Validação:
            expect(result).toHaveProperty('success', false);
            expect(result).toHaveProperty('error', 'Token de segurança inválido');
            expect(bullQueueMock.add).not.toHaveBeenCalled();
        });
    });

    // Objetivo: Fluxo feliz fim a fim 
    describe('Processamento Correto e Enfileiramento em Fila Assíncrona', () => {
        it('deve_enfileirar_payload_no_bullmq_e_retornar_sucesso_quando_validacao_passar', async () => {
            // Estado inicial: Instância existe com token criptografado
            prismaServiceMock.whatsAppInstance.findUnique.mockResolvedValueOnce({
                id: 'inst-123',
                zapiInstanceId: 'inst-123',
                zapiClientToken: 'enc:token_secreto_valido'
            });

            // Contexto: Mensagem legítima enviada pelo disparador da Z-API (token e IDs corretos)
            const payloadLegitimo = {
                instanceId: 'inst-123',
                type: 'Message',
                clientToken: 't0k3n_v4l1d0',
                phone: '5511999999999',
                text: { message: 'Olá, gostaria de refatorar o sistema' }
            };

            const result = await webhooksController.handleZApiWebhook(payloadLegitimo as any);

            // Validação:
            // 1. O Controller não deve processar a mensagem no momento, e sim, devolver `202 Accepted` velozmente
            // 2. Ele avisa que foi enfileirado (`queued: true`)
            // 3. O payload inteiro deve ser enviado para a fila do BullMQ
            expect(result).toHaveProperty('queued', true);
            expect(result).not.toHaveProperty('success', false); // garante que não caiu nos return { success: false }

            expect(bullQueueMock.add).toHaveBeenCalledWith('process', {
                type: 'Message',
                payload: payloadLegitimo
            });
        });

        it('deve_ignorar_eventos_do_tipo_delivery_callback_para_poupar_recursos_do_servidor', async () => {
             // Estado inicial: Validação passa
             prismaServiceMock.whatsAppInstance.findUnique.mockResolvedValueOnce({
                id: 'inst-123',
                zapiInstanceId: 'inst-123',
                zapiClientToken: 'enc:token_secreto_valido'
            });

            // Contexto: Payload é de um mero 'DeliveryCallback' 
            const payloadDelivery = {
                instanceId: 'inst-123',
                type: 'DeliveryCallback',
                clientToken: 't0k3n_v4l1d0',
                messageId: 'msg-abc'
            };

            const result = await webhooksController.handleZApiWebhook(payloadDelivery as any);

            expect(result).toHaveProperty('queued', false);
            expect(result).toHaveProperty('reason', 'delivery_ack_only');
            
            // Garantir que a fila **NÃO** foi entupida com lixos irrelevantes
            expect(bullQueueMock.add).not.toHaveBeenCalled();
        });
    });
});
