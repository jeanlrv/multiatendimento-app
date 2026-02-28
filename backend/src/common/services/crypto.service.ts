import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Serviço de criptografia AES-256-GCM para tokens e senhas em repouso.
 *
 * Valores criptografados têm o prefixo `enc:` para distinguir de legado plaintext.
 * Se ENCRYPTION_KEY não estiver configurado, o sistema não deve iniciar (validado em main.ts).
 */
@Injectable()
export class CryptoService {
    private readonly logger = new Logger(CryptoService.name);
    private readonly algorithm = 'aes-256-gcm';
    private readonly key: Buffer;

    constructor(private config: ConfigService) {
        const keyStr = config.get<string>('ENCRYPTION_KEY', '');

        if (!keyStr || keyStr.length < 32) {
            throw new Error('ENCRYPTION_KEY deve ser configurado com pelo menos 32 caracteres');
        }

        // Derivar chave de 32 bytes a partir da string fornecida
        this.key = crypto.createHash('sha256').update(keyStr).digest();
    }

    /**
     * Criptografa um texto. Retorna no formato `enc:<iv>:<tag>:<dados>`.
     * Se ENCRYPTION_KEY não configurado, retorna o texto sem alteração.
     */
    encrypt(text: string): string {
        if (!text) return text;
        if (!this.key) return text;
        if (typeof text !== 'string') return text;
        if (text.startsWith('enc:')) return text; // Já criptografado

        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
        const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();

        return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
    }

    /**
     * Descriptografa um valor. Se não tiver prefixo `enc:`, retorna como plaintext (legado).
     */
    decrypt(text: string): string {
        if (!text) return text;
        if (!text.startsWith('enc:')) return text; // Plaintext legado — retornar sem alteração
        if (!this.key) return text; // Sem chave — não pode descriptografar

        try {
            const parts = text.split(':');
            if (parts.length !== 4) return text;

            const [, ivHex, tagHex, encHex] = parts;
            const iv = Buffer.from(ivHex, 'hex');
            const tag = Buffer.from(tagHex, 'hex');
            const encryptedData = Buffer.from(encHex, 'hex');

            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            decipher.setAuthTag(tag);

            return decipher.update(encryptedData).toString('utf8') + decipher.final('utf8');
        } catch (e) {
            this.logger.error('Falha ao descriptografar valor — retornando como plaintext');
            return text;
        }
    }

    /**
     * Mascara um valor para exibição segura na API.
     * Mostra os primeiros 4 caracteres e substitui o resto por asteriscos.
     */
    mask(value: string): string {
        if (!value) return '';
        const plain = this.decrypt(value);
        if (!plain) return '';
        const visible = plain.substring(0, 4);
        const masked = '*'.repeat(Math.max(8, plain.length - 4));
        return `${visible}${masked}`;
    }
}
