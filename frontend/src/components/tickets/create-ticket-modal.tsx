'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, User, Building, Tag as TagIcon, Phone } from 'lucide-react'; // Changed MessageSquare to Phone or keep generic
import { motion, AnimatePresence } from 'framer-motion';
import { DepartmentsService, Department } from '@/services/departments';
import { TagsService, Tag } from '@/services/tags';
import { ContactsService, Contact } from '@/services/contacts';
import { api } from '@/services/api';

const ticketSchema = z.object({
    contactId: z.string().min(1, 'Contato é obrigatório'),
    departmentId: z.string().min(1, 'Departamento é obrigatório'),
    subject: z.string().min(1, 'Assunto é obrigatório'),
    tags: z.array(z.string()).optional(),
});

type TicketForm = z.infer<typeof ticketSchema>;

interface CreateTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateTicketModal({ isOpen, onClose, onSuccess }: CreateTicketModalProps) {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);
    const [contactSearch, setContactSearch] = useState('');

    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<TicketForm>({
        resolver: zodResolver(ticketSchema),
    });

    useEffect(() => {
        if (isOpen) {
            DepartmentsService.findAll().then(setDepartments);
            TagsService.findAll().then(setTags);
            ContactsService.findAll().then(res => setContacts(res.data));
        }
    }, [isOpen]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (isOpen) {
                ContactsService.findAll(contactSearch).then(res => setContacts(res.data));
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [contactSearch, isOpen]);

    const onSubmit = async (data: TicketForm) => {
        try {
            setLoading(true);
            // Default connection ID needs to be handled? 
            // For now, we might need a default connection or let backend handle it?
            // The DTO requires connectionId. We need to fetch it or hardcode for now if not available.
            // Let's assume we fetch connections or use a default one.
            // Actually, we should let the user select a connection if multiple exist, or take the first one.
            // Let's fetch connections.

            // Temporary: fetch first connection
            // We need a ConnectionsService or just call API directly here for MVP
            const connectionsRes = await api.get('/whatsapp');
            const connectedConnections = connectionsRes.data.filter((c: any) => c.status === 'CONNECTED');
            const connectionId = connectedConnections[0]?.id;

            if (!connectionId) {
                alert('Nenhuma conexão WhatsApp ativa encontrada. Conecte uma instância primeiro.');
                setLoading(false);
                return;
            }

            await api.post('/tickets', {
                ...data,
                connectionId
            });

            onSuccess();
            onClose();
            reset();
        } catch (error) {
            console.error('Erro ao criar ticket:', error);
        } finally {
            setLoading(false);
        }
    };

    const selectedTags = watch('tags') || [];

    const toggleTag = (tagId: string) => {
        const currentTags = selectedTags;
        if (currentTags.includes(tagId)) {
            setValue('tags', currentTags.filter(id => id !== tagId));
        } else {
            setValue('tags', [...currentTags, tagId]);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900 flex-shrink-0">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Novo Atendimento
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 overflow-y-auto">
                            {/* Contact Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <User className="h-4 w-4" /> Contato
                                </label>
                                <input
                                    type="text"
                                    placeholder="Buscar contato..."
                                    value={contactSearch}
                                    onChange={e => setContactSearch(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20 text-sm mb-2"
                                />
                                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-xl p-2">
                                    {contacts.map(contact => (
                                        <label key={contact.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
                                            <input
                                                type="radio"
                                                value={contact.id}
                                                {...register('contactId')}
                                                className="text-blue-600"
                                            />
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white">{contact.name || 'Sem nome'}</p>
                                                <p className="text-xs text-gray-500">{contact.phoneNumber}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                {errors.contactId && <p className="text-red-500 text-xs">{errors.contactId.message}</p>}
                            </div>

                            {/* Subject Field */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Phone className="h-4 w-4" /> Assunto
                                </label>
                                <input
                                    type="text"
                                    {...register('subject')}
                                    placeholder="Ex: Dúvida sobre produto..."
                                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                                />
                                {errors.subject && <p className="text-red-500 text-xs">{errors.subject.message}</p>}
                            </div>

                            {/* Department Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Building className="h-4 w-4" /> Departamento
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {departments.map(dept => (
                                        <label key={dept.id} className={`
                                            flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all
                                            ${watch('departmentId') === dept.id
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}
                                        `}>
                                            <input
                                                type="radio"
                                                value={dept.id}
                                                {...register('departmentId')}
                                                className="sr-only"
                                            />
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{dept.name}</span>
                                        </label>
                                    ))}
                                </div>
                                {errors.departmentId && <p className="text-red-500 text-xs">{errors.departmentId.message}</p>}
                            </div>

                            {/* Tags Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <TagIcon className="h-4 w-4" /> Tags (Opcional)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map(tag => (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            onClick={() => toggleTag(tag.id)}
                                            className={`
                                                px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                                                ${selectedTags.includes(tag.id)
                                                    ? 'border-transparent text-white shadow-sm'
                                                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}
                                            `}
                                            style={{
                                                backgroundColor: selectedTags.includes(tag.id) ? tag.color : 'transparent',
                                                borderColor: selectedTags.includes(tag.id) ? tag.color : undefined
                                            }}
                                        >
                                            {tag.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </form>

                        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmit(onSubmit)}
                                disabled={loading}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Criando...' : 'Iniciar Atendimento'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
