import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from '../../database/prisma.service';
import { createPrismaMock } from '../../database/prisma-mock';
import { ConfigService } from '@nestjs/config';
import { IntegrationsService } from '../settings/integrations.service';
import { CryptoService } from '../../common/services/crypto.service';
import axios from 'axios';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        post: jest.fn().mockResolvedValue({ data: { messageId: 'zaap-msg-1' } }),
        get: jest.fn().mockResolvedValue({ data: {} }),
    },
    post: jest.fn().mockResolvedValue({ data: { messageId: 'zaap-msg-1' } }),
    get: jest.fn().mockResolvedValue({ data: {} }),
}));

describe('WhatsAppService', () => {
    let service: WhatsAppService;
    let prisma: jest.Mocked<PrismaService>;
    let cryptoService: jest.Mocked<CryptoService>;
    let integrationsService: jest.Mocked<IntegrationsService>;

    beforeEach(async () => {
        const prismaMock = createPrismaMock();
        // Garantir que o create retorne um ID para o registerWebhook não falhar
        prismaMock.whatsAppInstance.create.mockImplementation(({ data }) => Promise.resolve({ id: 'new-conn-id', ...data }));

        const configMock = {
            get: jest.fn().mockImplementation((key) => {
                if (key === 'ZAPI_BASE_URL') return 'https://api.z-api.io';
                return undefined;
            }),
        };

        const cryptoMock = {
            encrypt: jest.fn().mockImplementation(val => val ? `enc:${val}` : val),
            decrypt: jest.fn().mockImplementation(val => val?.startsWith('enc:') ? val.substring(4) : val),
            mask: jest.fn().mockImplementation(val => val ? '****' : ''),
        };

        const integrationsMock = {
            getSettingValue: jest.fn(),
            findZapiConfig: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WhatsAppService,
                { provide: PrismaService, useValue: prismaMock },
                { provide: ConfigService, useValue: configMock },
                { provide: CryptoService, useValue: cryptoMock },
                { provide: IntegrationsService, useValue: integrationsMock },
            ],
        }).compile();

        service = module.get<WhatsAppService>(WhatsAppService);
        prisma = module.get(PrismaService);
        cryptoService = module.get(CryptoService);
        integrationsService = module.get(IntegrationsService);
        
        if (axios && axios.post && (axios.post as any).mockClear) {
            (axios.post as jest.Mock).mockClear();
        }
    });

    // ── create ──────────────────────────────────────────────────────────────────

    it('create deve criptografar zapiToken e zapiClientToken ao salvar', async () => {
        const dto = { name: 'Zap', instanceId: 'inst-1', zapiToken: 'tok-sec', zapiClientToken: 'client-sec' };
        
        await service.create(dto as any, 'comp-1');

        expect(cryptoService.encrypt).toHaveBeenCalledWith('tok-sec');
        expect(cryptoService.encrypt).toHaveBeenCalledWith('client-sec');
        expect(prisma.whatsAppInstance.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                zapiToken: 'enc:tok-sec',
                zapiClientToken: 'enc:client-sec'
            })
        }));
    });

    // ── resolveCredentials ──────────────────────────────────────────────────────

    it('resolveCredentials deve descriptografar tokens da instância', async () => {
        const connection = {
            zapiInstanceId: 'inst-1',
            zapiToken: 'enc:inst-tok',
            zapiClientToken: 'enc:client-tok',
        };

        const result = await service['resolveCredentials'](connection, 'comp-1');

        expect(result).toEqual({ 
            instanceId: 'inst-1',
            token: 'inst-tok', 
            clientToken: 'client-tok'
        });
        expect(cryptoService.decrypt).toHaveBeenCalledWith('enc:inst-tok');
        expect(cryptoService.decrypt).toHaveBeenCalledWith('enc:client-tok');
    });

    it('resolveCredentials deve fazer fallback para Integration global caso tokens nulos', async () => {
        // Conexão tem instanceId mas não os tokens de acesso (comum em setups onde token é global)
        const connection = {
            zapiInstanceId: 'inst-1',
            zapiToken: null,
            zapiClientToken: null,
        };

        (integrationsService.findZapiConfig as jest.Mock).mockResolvedValue({
            zapiInstanceId: 'inst-1',
            zapiToken: 'global-tok',
            zapiClientToken: 'global-client'
        });

        const result = await service['resolveCredentials'](connection, 'comp-1');

        expect(result.token).toBe('global-tok');
        expect(result.clientToken).toBe('global-client');
        expect(integrationsService.findZapiConfig).toHaveBeenCalledWith('comp-1');
    });

    // ── sendMessage ─────────────────────────────────────────────────────────────

    it('sendMessage deve fazer chamada HTTP POST à Z-API com token descriptografado e usar Circuit Breaker', async () => {
        // Mock do resolveCredentials
        jest.spyOn(service as any, 'resolveCredentials').mockResolvedValue({
            instanceId: 'MY-INST',
            token: 'MY-TOK',
            clientToken: 'MY-CLIENT'
        });

        // Mock do banco de dados para o getInternal
        (prisma as any).whatsAppInstance.findUnique.mockResolvedValue({ 
            id: 'conn-1', 
            companyId: 'comp-1', 
            instanceId: 'inst-1',
            zapiToken: 'enc:tok'
        });

        const result = await service.sendMessage('conn-1', '551199999999', 'Hello', 'comp-1');

        expect(result).toEqual({ messageId: 'zaap-msg-1' });
        // Valida que fez GET/POST em `https://api.z-api.io/instances/MY-INST/token/MY-TOK/send-text`
        expect(axios.post).toHaveBeenCalledWith(
            'https://api.z-api.io/instances/MY-INST/token/MY-TOK/send-text',
            { phone: '551199999999', message: 'Hello' },
            expect.objectContaining({ 
                headers: expect.objectContaining({ 'Client-Token': 'MY-CLIENT' }) 
            })
        );
    });

    // ── maskConnection ──────────────────────────────────────────────────────────

    it('maskConnection deve ocultar tokens sensíveis na resposta', () => {
        const conn = {
            id: '1',
            name: 'Zap',
            zapiToken: 'enc:secret',
            zapiClientToken: 'enc:client'
        };

        const masked = service['maskConnection'](conn as any);

        // O serviço agora mascara parcialmente: prefixo de 4 caracteres + asteriscos
        // 'secret' -> 'secr' + '****' (Math.max(4, 6-4=2))
        expect(masked.zapiToken).toBe('secr****'); 
        expect(masked.zapiClientToken).toBe('***CONFIGURADO***');
        expect(cryptoService.decrypt).toHaveBeenCalledWith('enc:secret');
    });
});
