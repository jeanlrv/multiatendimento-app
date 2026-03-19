import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

// ── Helpers ──────────────────────────────────────────────────────────────────────

const mockConfigService = (key: string = 'a]super-secret-encryption-key-32+') => ({
    get: jest.fn((k: string, def?: string) => (k === 'ENCRYPTION_KEY' ? key : def)),
});

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('CryptoService', () => {
    let service: CryptoService;

    beforeEach(() => {
        service = new CryptoService(
            mockConfigService() as unknown as ConfigService,
        );
    });

    // ── Constructor ────────────────────────────────────────────────────────────

    it('deve lançar erro se ENCRYPTION_KEY tiver menos de 32 caracteres', () => {
        expect(() =>
            new CryptoService(mockConfigService('short') as unknown as ConfigService),
        ).toThrow('ENCRYPTION_KEY deve ser configurado com pelo menos 32 caracteres');
    });

    it('deve lançar erro se ENCRYPTION_KEY estiver vazia', () => {
        expect(() =>
            new CryptoService(mockConfigService('') as unknown as ConfigService),
        ).toThrow('ENCRYPTION_KEY deve ser configurado com pelo menos 32 caracteres');
    });

    // ── encrypt ────────────────────────────────────────────────────────────────

    it('deve retornar string com prefixo enc:', () => {
        const result = service.encrypt('minha-senha-secreta');
        expect(result).toMatch(/^enc:/);
    });

    it('deve retornar formato enc:iv:tag:dados', () => {
        const result = service.encrypt('teste');
        const parts = result.split(':');
        expect(parts).toHaveLength(4);
        expect(parts[0]).toBe('enc');
        // IV = 12 bytes = 24 hex chars
        expect(parts[1]).toHaveLength(24);
        // AuthTag = 16 bytes = 32 hex chars
        expect(parts[2]).toHaveLength(32);
    });

    it('deve gerar valores diferentes para a mesma entrada (IV aleatório)', () => {
        const a = service.encrypt('mesma-entrada');
        const b = service.encrypt('mesma-entrada');
        expect(a).not.toBe(b);
    });

    it('deve retornar valores falsy sem alteração', () => {
        expect(service.encrypt('')).toBe('');
        expect(service.encrypt(null as any)).toBe(null);
        expect(service.encrypt(undefined as any)).toBe(undefined);
    });

    it('deve retornar texto já criptografado sem alteração (idempotente)', () => {
        const encrypted = service.encrypt('abc');
        const doubleEncrypted = service.encrypt(encrypted);
        expect(doubleEncrypted).toBe(encrypted);
    });

    // ── decrypt ────────────────────────────────────────────────────────────────

    it('deve reverter encrypt ao valor original', () => {
        const original = 'minha-senha-secreta-123!@#';
        const encrypted = service.encrypt(original);
        const decrypted = service.decrypt(encrypted);
        expect(decrypted).toBe(original);
    });

    it('deve retornar plaintext sem prefixo enc: (backward compat)', () => {
        const legacy = 'token-antigo-sem-criptografia';
        expect(service.decrypt(legacy)).toBe(legacy);
    });

    it('deve retornar valores falsy sem alteração', () => {
        expect(service.decrypt('')).toBe('');
        expect(service.decrypt(null as any)).toBe(null);
    });

    it('deve lançar erro com chave errada', () => {
        const encrypted = service.encrypt('dados-sensíveis');
        const wrongKeyService = new CryptoService(
            mockConfigService('outra-chave-de-criptografia-32!!') as unknown as ConfigService,
        );
        expect(() => wrongKeyService.decrypt(encrypted)).toThrow('Falha ao descriptografar');
    });

    it('deve lançar erro com formato inválido', () => {
        expect(() => service.decrypt('enc:invalid')).toThrow();
    });

    // ── mask ────────────────────────────────────────────────────────────────────

    it('deve exibir apenas 4 primeiros caracteres', () => {
        const encrypted = service.encrypt('1234567890');
        const masked = service.mask(encrypted);
        expect(masked).toMatch(/^1234\*+$/);
    });

    it('deve retornar string vazia para valor vazio', () => {
        expect(service.mask('')).toBe('');
    });

    it('deve retornar **** para valor corrompido', () => {
        expect(service.mask('enc:invalid')).toBe('****');
    });

    it('deve mascarar valor plaintext (legado)', () => {
        const masked = service.mask('token-legado-abc');
        expect(masked.startsWith('toke')).toBe(true);
        expect(masked).toContain('*');
    });
});
