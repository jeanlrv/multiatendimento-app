import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CustomersService } from '../customers/customers.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ContactsService {
    constructor(
        private prisma: PrismaService,
        private customersService: CustomersService,
    ) {}

    async create(createContactDto: CreateContactDto, companyId: string) {
        const existing = await this.prisma.contact.findFirst({
            where: { companyId, phoneNumber: createContactDto.phoneNumber },
        });
        if (existing) {
            throw new ConflictException('Já existe um contato com este número de telefone.');
        }

        // Encontra ou cria um Customer para este contato
        const customerId = await this.customersService.findOrCreateByPhone(
            companyId,
            createContactDto.phoneNumber,
            createContactDto.name,
        );

        return this.prisma.contact.create({
            data: { ...createContactDto, companyId, customerId },
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

    async checkDuplicate(companyId: string, phone: string, excludeId?: string) {
        const normalized = phone.replace(/[\s\-\+\(\)]/g, '');
        const contacts = await this.prisma.contact.findMany({
            where: {
                companyId,
                phoneNumber: { contains: normalized },
                ...(excludeId && { id: { not: excludeId } }),
            },
            select: { id: true, name: true, phoneNumber: true },
            take: 3,
        });
        return { duplicates: contacts };
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

        // ── Passo 1: parse e validação em memória (sem queries) ──────────────
        type ParsedRow = { phone: string; name?: string; email?: string; notes?: string };
        const validRows: ParsedRow[] = [];
        let failed = 0;
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
            const phone = (row[idx.phone] ?? '').replace(/\D/g, '');
            if (!phone) {
                failed++;
                errors.push(`Linha ${i + 1}: telefone inválido (${row[idx.phone] ?? ''})`);
                continue;
            }
            validRows.push({
                phone,
                ...(idx.name !== -1 && row[idx.name] ? { name: row[idx.name] } : {}),
                ...(idx.email !== -1 && row[idx.email] ? { email: row[idx.email] } : {}),
                ...(idx.notes !== -1 && row[idx.notes] ? { notes: row[idx.notes] } : {}),
            });
        }

        if (validRows.length === 0) return { created: 0, updated: 0, failed, errors: errors.slice(0, 20) };

        const phones = [...new Set(validRows.map(r => r.phone))];

        // ── Passo 2: 2 queries para buscar existentes (antes eram N queries) ─
        const [existingContacts, existingCustomers] = await Promise.all([
            this.prisma.contact.findMany({
                where: { companyId, phoneNumber: { in: phones } },
                select: { id: true, phoneNumber: true },
            }),
            this.prisma.customer.findMany({
                where: { companyId, phonePrimary: { in: phones } },
                select: { id: true, phonePrimary: true },
            }),
        ]);

        const contactById = new Map(existingContacts.map(c => [c.phoneNumber, c.id]));
        const customerById = new Map(existingCustomers.map(c => [c.phonePrimary, c.id]));

        const toUpdate = validRows.filter(r => contactById.has(r.phone));
        const toCreate = validRows.filter(r => !contactById.has(r.phone));

        // ── Passo 3: updates em lotes paralelos de 50 ────────────────────────
        const CHUNK = 50;
        let updated = 0;
        for (let i = 0; i < toUpdate.length; i += CHUNK) {
            const chunk = toUpdate.slice(i, i + CHUNK);
            const results = await Promise.allSettled(
                chunk.map(row => this.prisma.contact.update({
                    where: { id: contactById.get(row.phone)! },
                    data: { phoneNumber: row.phone, name: row.name, email: row.email, notes: row.notes },
                })),
            );
            results.forEach((r, j) => {
                if (r.status === 'fulfilled') updated++;
                else { failed++; errors.push(`Telefone ${chunk[j].phone}: erro ao atualizar`); }
            });
        }

        // ── Passo 4: criar customers faltando em lote ─────────────────────────
        const newPhones = [...new Set(toCreate.map(r => r.phone).filter(p => !customerById.has(p)))];
        for (let i = 0; i < newPhones.length; i += CHUNK) {
            const chunk = newPhones.slice(i, i + CHUNK);
            const results = await Promise.allSettled(
                chunk.map(phone => this.prisma.customer.create({
                    data: {
                        name: toCreate.find(r => r.phone === phone)?.name || phone,
                        phonePrimary: phone,
                        companyId,
                    },
                    select: { id: true, phonePrimary: true },
                })),
            );
            results.forEach(r => {
                if (r.status === 'fulfilled') customerById.set(r.value.phonePrimary, r.value.id);
            });
        }

        // ── Passo 5: criar contatos em lote (createMany) ──────────────────────
        let created = 0;
        for (let i = 0; i < toCreate.length; i += CHUNK) {
            const chunk = toCreate.slice(i, i + CHUNK).filter(r => customerById.has(r.phone));
            if (chunk.length === 0) continue;
            try {
                await this.prisma.contact.createMany({
                    data: chunk.map(row => ({
                        phoneNumber: row.phone,
                        name: row.name || row.phone,
                        email: row.email,
                        notes: row.notes,
                        companyId,
                        customerId: customerById.get(row.phone)!,
                    })),
                    skipDuplicates: true,
                });
                created += chunk.length;
            } catch {
                // fallback individual para contabilizar erros precisos
                for (const row of chunk) {
                    try {
                        await this.prisma.contact.create({
                            data: {
                                phoneNumber: row.phone,
                                name: row.name || row.phone,
                                email: row.email,
                                notes: row.notes,
                                companyId,
                                customerId: customerById.get(row.phone)!,
                            },
                        });
                        created++;
                    } catch {
                        failed++;
                        errors.push(`Telefone ${row.phone}: erro ao criar contato`);
                    }
                }
            }
        }

        return { created, updated, failed, errors: errors.slice(0, 20) };
    }

    async mergeContact(companyId: string, sourceId: string, targetId: string) {
        if (sourceId === targetId) throw new BadRequestException('Contatos devem ser diferentes');

        const [source, target] = await Promise.all([
            this.prisma.contact.findFirst({ where: { id: sourceId, companyId } }),
            this.prisma.contact.findFirst({ where: { id: targetId, companyId } }),
        ]);

        if (!source) throw new NotFoundException('Contato de origem não encontrado');
        if (!target) throw new NotFoundException('Contato de destino não encontrado');

        await this.prisma.$transaction(async (tx) => {
            // Reassign all tickets from source to target
            await tx.ticket.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } });
            // Reassign schedules
            await tx.schedule.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } });
            // Reassign broadcast recipients
            await tx.broadcastRecipient.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } });
            // Merge notes/info into target
            const mergedNotes = [target.notes, source.notes].filter(Boolean).join('\n---\n') || null;
            await tx.contact.update({
                where: { id: targetId },
                data: {
                    email: target.email || source.email,
                    notes: mergedNotes,
                    information: target.information || source.information,
                },
            });
            // Delete source
            await tx.contact.delete({ where: { id: sourceId } });
        });

        return this.prisma.contact.findUnique({ where: { id: targetId } });
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
