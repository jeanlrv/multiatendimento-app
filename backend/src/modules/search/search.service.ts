import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SearchService {
    constructor(private prisma: PrismaService) {}

    async globalSearch(companyId: string, q: string, types: string[] = ['tickets', 'contacts', 'customers']) {
        const term = q.trim();
        if (!term || term.length < 2) return { tickets: [], contacts: [], customers: [] };

        const results: any = {};

        if (types.includes('tickets')) {
            results.tickets = await this.prisma.ticket.findMany({
                where: {
                    companyId,
                    OR: [
                        { subject: { contains: term, mode: 'insensitive' } },
                        { contact: { name: { contains: term, mode: 'insensitive' } } },
                        { contact: { phoneNumber: { contains: term } } },
                    ],
                },
                select: {
                    id: true,
                    subject: true,
                    status: true,
                    updatedAt: true,
                    contact: { select: { name: true, phoneNumber: true } },
                    department: { select: { name: true, emoji: true, color: true } },
                },
                orderBy: { updatedAt: 'desc' },
                take: 5,
            });
        }

        if (types.includes('contacts')) {
            results.contacts = await this.prisma.contact.findMany({
                where: {
                    companyId,
                    OR: [
                        { name: { contains: term, mode: 'insensitive' } },
                        { phoneNumber: { contains: term } },
                        { email: { contains: term, mode: 'insensitive' } },
                    ],
                },
                select: { id: true, name: true, phoneNumber: true, email: true },
                orderBy: { createdAt: 'desc' },
                take: 5,
            });
        }

        if (types.includes('customers')) {
            results.customers = await this.prisma.customer.findMany({
                where: {
                    companyId,
                    OR: [
                        { name: { contains: term, mode: 'insensitive' } },
                        { phonePrimary: { contains: term } },
                        { emailPrimary: { contains: term, mode: 'insensitive' } },
                        { cpfCnpj: { contains: term } },
                    ],
                },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    status: true,
                    phonePrimary: true,
                    emailPrimary: true,
                    cpfCnpj: true,
                    _count: { select: { contacts: true } },
                },
                orderBy: { updatedAt: 'desc' },
                take: 5,
            });
        }

        return results;
    }
}
