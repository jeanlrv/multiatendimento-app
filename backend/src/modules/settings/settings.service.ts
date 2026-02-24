import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CryptoService } from '../../common/services/crypto.service';

@Injectable()
export class SettingsService {
    constructor(
        private prisma: PrismaService,
        private crypto: CryptoService,
    ) { }

    /** Retorna configuração SMTP com senha mascarada (para API) */
    async getSmtpConfig(companyId: string) {
        const config = await this.prisma.sMTPConfig.findFirst({
            where: { isDefault: true, companyId }
        });

        if (!config) return null;

        return {
            ...config,
            password: config.password ? this.crypto.mask(config.password) : '',
        };
    }

    /** Uso interno — retorna senha descriptografada para envio de email */
    async getSmtpConfigDecrypted(companyId: string) {
        const config = await this.prisma.sMTPConfig.findFirst({
            where: { isDefault: true, isActive: true, companyId }
        });

        if (!config) return null;

        return {
            ...config,
            password: this.crypto.decrypt(config.password),
        };
    }

    async updateSmtpConfig(companyId: string, data: any) {
        const payload = { ...data };

        // Criptografar a senha apenas se não for máscara (*** indica que não foi alterada)
        if (payload.password && !payload.password.includes('***')) {
            payload.password = this.crypto.encrypt(payload.password);
        } else if (payload.password?.includes('***')) {
            // Senha mascarada: não atualizar
            delete payload.password;
        }

        const existing = await this.prisma.sMTPConfig.findFirst({
            where: { isDefault: true, companyId }
        });

        if (existing) {
            const updated = await this.prisma.sMTPConfig.update({
                where: { id: existing.id },
                data: {
                    ...payload,
                    isDefault: true,
                    isActive: true,
                    companyId
                }
            });
            return { ...updated, password: updated.password ? this.crypto.mask(updated.password) : '' };
        }

        const created = await this.prisma.sMTPConfig.create({
            data: {
                ...payload,
                name: 'Servidor Padrão',
                isDefault: true,
                isActive: true,
                companyId
            }
        });
        return { ...created, password: created.password ? this.crypto.mask(created.password) : '' };
    }

    async getGeneralSettings(companyId: string) {
        const settings = await this.prisma.setting.findMany({
            where: { companyId }
        });
        const map: Record<string, any> = {};
        for (const s of settings) {
            try {
                map[s.key] = typeof s.value === 'string' ? JSON.parse(s.value as string) : s.value;
            } catch {
                map[s.key] = s.value;
            }
        }
        return map;
    }

    async updateSetting(companyId: string, key: string, value: any) {
        return this.prisma.setting.upsert({
            where: {
                companyId_key: { companyId, key }
            },
            update: { value: JSON.stringify(value) },
            create: {
                companyId,
                key,
                value: JSON.stringify(value)
            }
        });
    }

    async bulkUpdate(companyId: string, data: Record<string, any>) {
        const operations = Object.entries(data).map(([key, value]) =>
            this.prisma.setting.upsert({
                where: {
                    companyId_key: { companyId, key }
                },
                update: { value: JSON.stringify(value) },
                create: {
                    companyId,
                    key,
                    value: JSON.stringify(value)
                },
            })
        );
        return this.prisma.$transaction(operations);
    }
}
