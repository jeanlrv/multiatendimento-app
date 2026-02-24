import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ContactsService {
    constructor(private prisma: PrismaService) { }

    async create(createContactDto: CreateContactDto, companyId: string) {
        const existing = await this.prisma.contact.findFirst({
            where: { companyId, phoneNumber: createContactDto.phoneNumber },
        });
        if (existing) {
            throw new ConflictException('Já existe um contato com este número de telefone.');
        }
        return this.prisma.contact.create({
            data: { ...createContactDto, companyId },
        });
    }

    async findAll(companyId: string, search?: string, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const filteredWhere: Prisma.ContactWhereInput = {
            companyId,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { phoneNumber: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };

        const [data, filteredTotal, globalTotal, highRiskCount] = await Promise.all([
            this.prisma.contact.findMany({
                where: filteredWhere,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.contact.count({ where: filteredWhere }),
            this.prisma.contact.count({ where: { companyId } }),
            this.prisma.contact.count({ where: { companyId, riskScore: { gt: 80 } } }),
        ]);

        return {
            data,
            total: filteredTotal,
            page,
            lastPage: Math.ceil(filteredTotal / limit) || 1,
            metrics: {
                total: globalTotal,
                highRisk: highRiskCount,
            },
        };
    }

    async findOne(companyId: string, id: string) {
        const contact = await this.prisma.contact.findFirst({
            where: { id, companyId },
        });
        if (!contact) throw new NotFoundException('Contato não encontrado ou acesso negado');
        return contact;
    }

    async update(companyId: string, id: string, data: UpdateContactDto) {
        await this.findOne(companyId, id);
        return this.prisma.contact.update({
            where: { id },
            data,
        });
    }

    async remove(companyId: string, id: string) {
        await this.findOne(companyId, id);
        return this.prisma.contact.delete({ where: { id } });
    }

    async importCSV(companyId: string, csvBuffer: Buffer): Promise<{ created: number; updated: number; failed: number; errors: string[] }> {
        const content = csvBuffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = content.split('\n').filter(l => l.trim());

        if (lines.length < 2) {
            return { created: 0, updated: 0, failed: 0, errors: ['Arquivo CSV vazio ou sem dados'] };
        }

        // Detectar separador (;  ou ,)
        const header = lines[0];
        const sep = header.includes(';') ? ';' : ',';
        const cols = header.split(sep).map(c => c.trim().toLowerCase().replace(/"/g, ''));

        // Mapeamento flexível de colunas
        const idx = {
            phone: cols.findIndex(c => ['telefone', 'phone', 'phonenumber', 'celular', 'fone', 'whatsapp'].includes(c)),
            name: cols.findIndex(c => ['nome', 'name'].includes(c)),
            email: cols.findIndex(c => ['email', 'e-mail', 'mail'].includes(c)),
            notes: cols.findIndex(c => ['notas', 'notes', 'observacoes', 'obs'].includes(c)),
        };

        if (idx.phone === -1) {
            return { created: 0, updated: 0, failed: 0, errors: ['Coluna de telefone não encontrada. Use: telefone, phone, celular, whatsapp'] };
        }

        let created = 0, updated = 0, failed = 0;
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
            const phoneRaw = row[idx.phone] ?? '';
            const phone = phoneRaw.replace(/\D/g, '');

            if (!phone) {
                failed++;
                errors.push(`Linha ${i + 1}: telefone inválido (${phoneRaw})`);
                continue;
            }

            try {
                const data = {
                    phoneNumber: phone,
                    ...(idx.name !== -1 && row[idx.name] && { name: row[idx.name] }),
                    ...(idx.email !== -1 && row[idx.email] && { email: row[idx.email] }),
                    ...(idx.notes !== -1 && row[idx.notes] && { notes: row[idx.notes] }),
                };

                const existing = await this.prisma.contact.findFirst({ where: { companyId, phoneNumber: phone } });
                if (existing) {
                    await this.prisma.contact.update({ where: { id: existing.id }, data });
                    updated++;
                } else {
                    await this.prisma.contact.create({ data: { ...data, companyId } });
                    created++;
                }
            } catch {
                failed++;
                errors.push(`Linha ${i + 1}: erro ao processar telefone ${phone}`);
            }
        }

        return { created, updated, failed, errors: errors.slice(0, 20) };
    }

    async exportCSV(companyId: string): Promise<string> {
        const contacts = await this.prisma.contact.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
            select: { name: true, phoneNumber: true, email: true, notes: true },
        });

        const escape = (val: string | null | undefined): string => {
            const s = val ?? '';
            if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        };

        const header = 'Nome;Telefone;Email;Notas\n';
        const rows = contacts
            .map(c => [escape(c.name), escape(c.phoneNumber), escape(c.email), escape(c.notes)].join(';'))
            .join('\n');

        return header + rows;
    }
}
