import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
    constructor(
        private prisma: PrismaService,
        private eventEmitter: EventEmitter2,
    ) {}

    // ─── CRUD básico ──────────────────────────────────────────────────────────

    private normalizeCpfCnpj(value?: string): string | undefined {
        return value ? value.replace(/[\.\-\/]/g, '') : undefined;
    }

    async create(dto: CreateCustomerDto, companyId: string) {
        const customer = await this.prisma.customer.create({
            data: { ...dto, cpfCnpj: this.normalizeCpfCnpj(dto.cpfCnpj), companyId },
            include: { contacts: true, tags: { include: { tag: true } }, customerNotes: true },
        });
        this.eventEmitter.emit('customer.created', { customerId: customer.id, companyId });
        return customer;
    }

    async findAll(companyId: string, search?: string, status?: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;

        const where: any = {
            companyId,
            ...(status && { status }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { emailPrimary: { contains: search, mode: 'insensitive' } },
                    { phonePrimary: { contains: search, mode: 'insensitive' } },
                    { cpfCnpj: { contains: search } },
                ],
            }),
        };

        const [data, total] = await Promise.all([
            this.prisma.customer.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    contacts: { select: { id: true, phoneNumber: true, name: true } },
                    tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
                    _count: { select: { contacts: true } },
                },
            }),
            this.prisma.customer.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            lastPage: Math.ceil(total / limit) || 1,
        };
    }

    async findOne(companyId: string, id: string) {
        const customer = await this.prisma.customer.findFirst({
            where: { id, companyId },
            include: {
                contacts: {
                    select: {
                        id: true,
                        phoneNumber: true,
                        name: true,
                        email: true,
                        profilePicture: true,
                        riskScore: true,
                        createdAt: true,
                    },
                },
                tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
                customerNotes: {
                    include: { agent: { select: { id: true, name: true, avatar: true } } },
                    orderBy: { createdAt: 'desc' },
                },
                customFields: { orderBy: { fieldName: 'asc' } },
            },
        });
        if (!customer) throw new NotFoundException('Cliente não encontrado ou acesso negado');
        return customer;
    }

    async update(companyId: string, id: string, dto: UpdateCustomerDto) {
        await this.assertExists(companyId, id);
        return this.prisma.customer.update({
            where: { id },
            data: { ...dto, ...(dto.cpfCnpj !== undefined && { cpfCnpj: this.normalizeCpfCnpj(dto.cpfCnpj) }) },
        });
    }

    async remove(companyId: string, id: string) {
        await this.assertExists(companyId, id);
        // Desvincula contatos antes de excluir (customerId → null)
        await this.prisma.contact.updateMany({
            where: { customerId: id },
            data: { customerId: null },
        });
        return this.prisma.customer.delete({ where: { id } });
    }

    // ─── Contatos do cliente ───────────────────────────────────────────────────

    async findContacts(companyId: string, customerId: string) {
        await this.assertExists(companyId, customerId);
        return this.prisma.contact.findMany({
            where: { customerId, companyId },
            select: {
                id: true,
                phoneNumber: true,
                name: true,
                email: true,
                profilePicture: true,
                riskScore: true,
                createdAt: true,
            },
        });
    }

    async linkContact(companyId: string, customerId: string, contactId: string) {
        await this.assertExists(companyId, customerId);
        const contact = await this.prisma.contact.findFirst({ where: { id: contactId, companyId } });
        if (!contact) throw new NotFoundException('Contato não encontrado');
        return this.prisma.contact.update({
            where: { id: contactId },
            data: { customerId },
        });
    }

    async unlinkContact(companyId: string, customerId: string, contactId: string) {
        await this.assertExists(companyId, customerId);
        const contact = await this.prisma.contact.findFirst({
            where: { id: contactId, companyId, customerId },
        });
        if (!contact) throw new NotFoundException('Contato não encontrado neste cliente');
        return this.prisma.contact.update({
            where: { id: contactId },
            data: { customerId: null },
        });
    }

    // ─── Histórico de conversas ───────────────────────────────────────────────

    async findConversations(companyId: string, customerId: string, page = 1, limit = 20) {
        await this.assertExists(companyId, customerId);
        const skip = (page - 1) * limit;

        const contacts = await this.prisma.contact.findMany({
            where: { customerId, companyId },
            select: { id: true },
        });
        const contactIds = contacts.map(c => c.id);

        const [data, total] = await Promise.all([
            this.prisma.ticket.findMany({
                where: { contactId: { in: contactIds }, companyId },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    contact: { select: { id: true, name: true, phoneNumber: true } },
                    department: { select: { id: true, name: true, emoji: true } },
                    assignedUser: { select: { id: true, name: true, avatar: true } },
                    _count: { select: { messages: true } },
                },
            }),
            this.prisma.ticket.count({ where: { contactId: { in: contactIds }, companyId } }),
        ]);

        return { data, total, page, lastPage: Math.ceil(total / limit) || 1 };
    }

    // ─── Notas internas ───────────────────────────────────────────────────────

    async addNote(companyId: string, customerId: string, agentId: string, note: string) {
        await this.assertExists(companyId, customerId);
        return this.prisma.customerNote.create({
            data: { customerId, agentId, note },
            include: { agent: { select: { id: true, name: true, avatar: true } } },
        });
    }

    async removeNote(companyId: string, customerId: string, noteId: string) {
        await this.assertExists(companyId, customerId);
        const existing = await this.prisma.customerNote.findFirst({
            where: { id: noteId, customerId },
        });
        if (!existing) throw new NotFoundException('Nota não encontrada');
        return this.prisma.customerNote.delete({ where: { id: noteId } });
    }

    // ─── Tags do cliente ──────────────────────────────────────────────────────

    async addTag(companyId: string, customerId: string, tagId: string) {
        await this.assertExists(companyId, customerId);
        const tag = await this.prisma.tag.findFirst({ where: { id: tagId, companyId } });
        if (!tag) throw new NotFoundException('Tag não encontrada');
        return this.prisma.customerTag.upsert({
            where: { customerId_tagId: { customerId, tagId } },
            create: { customerId, tagId },
            update: {},
        });
    }

    async removeTag(companyId: string, customerId: string, tagId: string) {
        await this.assertExists(companyId, customerId);
        await this.prisma.customerTag.deleteMany({ where: { customerId, tagId } });
        return { success: true };
    }

    // ─── Campos customizados ──────────────────────────────────────────────────

    async upsertCustomField(
        companyId: string,
        customerId: string,
        fieldName: string,
        fieldValue: string,
        fieldType = 'text',
    ) {
        await this.assertExists(companyId, customerId);
        const existing = await this.prisma.customerCustomField.findFirst({
            where: { customerId, fieldName },
        });
        if (existing) {
            return this.prisma.customerCustomField.update({
                where: { id: existing.id },
                data: { fieldValue, fieldType },
            });
        }
        return this.prisma.customerCustomField.create({
            data: { customerId, fieldName, fieldValue, fieldType },
        });
    }

    async removeCustomField(companyId: string, customerId: string, fieldName: string) {
        await this.assertExists(companyId, customerId);
        await this.prisma.customerCustomField.deleteMany({ where: { customerId, fieldName } });
        return { success: true };
    }

    // ─── Uso interno: findOrCreate ────────────────────────────────────────────
    /**
     * Encontra ou cria um Customer com base no phonePrimary + companyId.
     * Usado pelo ContactsService e WebhooksController ao criar contatos automaticamente.
     */
    async findOrCreateByPhone(
        companyId: string,
        phonePrimary: string,
        name?: string,
    ): Promise<string> {
        const existing = await this.prisma.customer.findFirst({
            where: { phonePrimary, companyId },
            select: { id: true },
        });
        if (existing) return existing.id;

        const created = await this.prisma.customer.create({
            data: {
                name: name || phonePrimary,
                phonePrimary,
                companyId,
            },
            select: { id: true },
        });
        return created.id;
    }

    // ─── Merge de clientes ────────────────────────────────────────────────────

    async mergeCustomers(companyId: string, sourceId: string, targetId: string) {
        if (sourceId === targetId) throw new BadRequestException('Clientes devem ser diferentes');
        const [source, target] = await Promise.all([
            this.prisma.customer.findFirst({ where: { id: sourceId, companyId } }),
            this.prisma.customer.findFirst({ where: { id: targetId, companyId } }),
        ]);
        if (!source) throw new NotFoundException('Cliente de origem não encontrado');
        if (!target) throw new NotFoundException('Cliente de destino não encontrado');

        await this.prisma.$transaction(async tx => {
            // Move todos os contatos do source para o target
            await tx.contact.updateMany({
                where: { customerId: sourceId },
                data: { customerId: targetId },
            });
            // Move notas
            await tx.customerNote.updateMany({
                where: { customerId: sourceId },
                data: { customerId: targetId },
            });
            // E1 — Fix N+1: single query fetching both source fields and target field names
            const allFields = await tx.customerCustomField.findMany({
                where: { customerId: { in: [sourceId, targetId] } },
                select: { id: true, customerId: true, fieldName: true },
            });
            const targetFieldNames = new Set(allFields.filter(f => f.customerId === targetId).map(f => f.fieldName));
            const toMoveIds = allFields.filter(f => f.customerId === sourceId && !targetFieldNames.has(f.fieldName)).map(f => f.id);
            if (toMoveIds.length > 0) {
                await tx.customerCustomField.updateMany({
                    where: { id: { in: toMoveIds } },
                    data: { customerId: targetId },
                });
            }
            // Merge notas de texto
            const mergedNotes = [target.notes, source.notes].filter(Boolean).join('\n---\n') || null;
            await tx.customer.update({
                where: { id: targetId },
                data: {
                    emailPrimary: target.emailPrimary || source.emailPrimary,
                    notes: mergedNotes,
                },
            });
            // Delete source
            await tx.customer.delete({ where: { id: sourceId } });
        });

        // E2 — Emit customer.merged event
        this.eventEmitter.emit('customer.merged', { sourceId, targetId, companyId });

        return this.findOne(companyId, targetId);
    }

    // ─── Helper privado ───────────────────────────────────────────────────────

    private async assertExists(companyId: string, id: string) {
        const exists = await this.prisma.customer.findFirst({
            where: { id, companyId },
            select: { id: true },
        });
        if (!exists) throw new NotFoundException('Cliente não encontrado ou acesso negado');
    }
}
