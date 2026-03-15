'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { customersService, Customer, CustomerNote } from '@/services/customers';
import { TagsService, Tag } from '@/services/tags';
import {
    User, Building2, Phone, Mail, ChevronDown, ChevronUp,
    Plus, Trash2, Edit3, Check, X, Loader2,
    CreditCard, Globe, AlertCircle, Link2Off
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
    contactId: string;
    onNavigateToTicket?: (ticketId: string) => void;
}

interface EditForm {
    name: string;
    type: 'PERSON' | 'COMPANY';
    status: 'LEAD' | 'ACTIVE' | 'INACTIVE';
    cpfCnpj: string;
    emailPrimary: string;
    phonePrimary: string;
    origin: string;
    notes: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    LEAD: { label: 'Lead', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    ACTIVE: { label: 'Ativo', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    INACTIVE: { label: 'Inativo', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

const TYPE_LABELS: Record<string, string> = {
    PERSON: 'Pessoa Física',
    COMPANY: 'Pessoa Jurídica',
};

export default function CustomerProfilePanel({ contactId, onNavigateToTicket }: Props) {
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Section expand state
    const [sections, setSections] = useState({
        info: true,
        contacts: false,
        tags: false,
        notes: false,
        fields: false,
        history: false,
    });

    // C1 — Inline edit
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState<EditForm>({
        name: '', type: 'PERSON', status: 'ACTIVE', cpfCnpj: '',
        emailPrimary: '', phonePrimary: '', origin: '', notes: '',
    });

    // C2 — Tag selector
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [showTagPicker, setShowTagPicker] = useState(false);
    const [addingTag, setAddingTag] = useState(false);
    const tagPickerRef = useRef<HTMLDivElement>(null);

    // Note input
    const [noteText, setNoteText] = useState('');
    const [addingNote, setAddingNote] = useState(false);

    // Custom field input
    const [addingField, setAddingField] = useState(false);
    const [newField, setNewField] = useState({ name: '', value: '', type: 'text' });

    // Conversations
    const [conversations, setConversations] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await customersService.findByContactId(contactId);
            setCustomer(data);
        } catch {
            setError('Não foi possível carregar o perfil do cliente.');
        } finally {
            setLoading(false);
        }
    }, [contactId]);

    useEffect(() => {
        if (contactId) load();
    }, [contactId, load]);

    // Load all tags when tag section opens
    useEffect(() => {
        if (sections.tags && allTags.length === 0) {
            TagsService.findAll().then(setAllTags).catch(() => {});
        }
    }, [sections.tags]);

    // Close tag picker on outside click
    useEffect(() => {
        if (!showTagPicker) return;
        const handler = (e: MouseEvent) => {
            if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
                setShowTagPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showTagPicker]);

    // C1 — start editing
    const startEdit = () => {
        if (!customer) return;
        setEditForm({
            name: customer.name,
            type: customer.type,
            status: customer.status,
            cpfCnpj: customer.cpfCnpj || '',
            emailPrimary: customer.emailPrimary || '',
            phonePrimary: customer.phonePrimary || '',
            origin: customer.origin || '',
            notes: customer.notes || '',
        });
        setEditing(true);
    };

    const handleSaveEdit = async () => {
        if (!customer) return;
        setSaving(true);
        try {
            const updated = await customersService.update(customer.id, {
                name: editForm.name,
                type: editForm.type,
                status: editForm.status,
                cpfCnpj: editForm.cpfCnpj || undefined,
                emailPrimary: editForm.emailPrimary || undefined,
                phonePrimary: editForm.phonePrimary || undefined,
                origin: editForm.origin || undefined,
                notes: editForm.notes || undefined,
            });
            setCustomer(c => c ? { ...c, ...updated } : c);
            setEditing(false);
            toast.success('Cliente atualizado');
        } catch {
            toast.error('Erro ao salvar alterações');
        } finally {
            setSaving(false);
        }
    };

    // C2 — add tag
    const handleAddTag = async (tag: Tag) => {
        if (!customer || customer.tags?.some(t => t.tagId === tag.id)) return;
        setAddingTag(true);
        try {
            await customersService.addTag(customer.id, tag.id);
            setCustomer(c => c ? {
                ...c,
                tags: [...(c.tags || []), { customerId: c.id, tagId: tag.id, tag: { id: tag.id, name: tag.name, color: tag.color } }],
            } : c);
            setShowTagPicker(false);
        } catch {
            toast.error('Erro ao adicionar tag');
        } finally {
            setAddingTag(false);
        }
    };

    // C3 — unlink contact
    const handleUnlinkContact = async (cId: string) => {
        if (!customer) return;
        try {
            await customersService.unlinkContact(customer.id, cId);
            setCustomer(c => c ? { ...c, contacts: c.contacts?.filter(ct => ct.id !== cId) } : c);
            toast.success('Contato desvinculado');
        } catch {
            toast.error('Erro ao desvincular contato');
        }
    };

    const loadHistory = async () => {
        if (!customer) return;
        setLoadingHistory(true);
        try {
            const res = await customersService.findConversations(customer.id, 1, 10);
            setConversations(res.data);
        } catch {
            toast.error('Erro ao carregar histórico');
        } finally {
            setLoadingHistory(false);
        }
    };

    const toggleSection = (key: keyof typeof sections) => {
        const next = !sections[key];
        setSections(s => ({ ...s, [key]: next }));
        if (key === 'history' && next && conversations.length === 0) loadHistory();
    };

    const handleAddNote = async () => {
        if (!customer || !noteText.trim()) return;
        setAddingNote(true);
        try {
            const note = await customersService.addNote(customer.id, noteText.trim());
            setCustomer(c => c ? { ...c, customerNotes: [note, ...(c.customerNotes || [])] } : c);
            setNoteText('');
            toast.success('Nota adicionada');
        } catch {
            toast.error('Erro ao adicionar nota');
        } finally {
            setAddingNote(false);
        }
    };

    const handleRemoveNote = async (noteId: string) => {
        if (!customer) return;
        try {
            await customersService.removeNote(customer.id, noteId);
            setCustomer(c => c ? { ...c, customerNotes: c.customerNotes?.filter(n => n.id !== noteId) } : c);
            toast.success('Nota removida');
        } catch {
            toast.error('Erro ao remover nota');
        }
    };

    const handleAddField = async () => {
        if (!customer || !newField.name.trim() || !newField.value.trim()) return;
        try {
            await customersService.upsertField(customer.id, newField.name.trim(), newField.value.trim(), newField.type);
            await load();
            setNewField({ name: '', value: '', type: 'text' });
            setAddingField(false);
            toast.success('Campo salvo');
        } catch {
            toast.error('Erro ao salvar campo');
        }
    };

    const handleRemoveField = async (fieldName: string) => {
        if (!customer) return;
        try {
            await customersService.removeField(customer.id, fieldName);
            setCustomer(c => c ? { ...c, customFields: c.customFields?.filter(f => f.fieldName !== fieldName) } : c);
            toast.success('Campo removido');
        } catch {
            toast.error('Erro ao remover campo');
        }
    };

    const handleRemoveTag = async (tagId: string) => {
        if (!customer) return;
        try {
            await customersService.removeTag(customer.id, tagId);
            setCustomer(c => c ? { ...c, tags: c.tags?.filter(t => t.tagId !== tagId) } : c);
        } catch {
            toast.error('Erro ao remover tag');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-primary" />
            </div>
        );
    }

    if (error || !customer) {
        return (
            <div className="flex flex-col items-center gap-2 py-8 text-slate-400 text-sm text-center px-4">
                <AlertCircle size={24} />
                <span>{error || 'Perfil do cliente não disponível'}</span>
            </div>
        );
    }

    const statusInfo = STATUS_LABELS[customer.status] ?? STATUS_LABELS.ACTIVE;
    const availableTags = allTags.filter(t => !customer.tags?.some(ct => ct.tagId === t.id));

    return (
        <div className="flex flex-col gap-0 text-sm">
            {/* Header do cliente */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-white/8">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {customer.type === 'COMPANY'
                            ? <Building2 size={18} className="text-primary" />
                            : <User size={18} className="text-primary" />
                        }
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-white truncate">{customer.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusInfo.color}`}>
                                {statusInfo.label}
                            </span>
                            <span className="text-[10px] text-slate-400">{TYPE_LABELS[customer.type]}</span>
                        </div>
                    </div>
                    {/* C1 — Edit button */}
                    {!editing && (
                        <button
                            onClick={startEdit}
                            title="Editar cliente"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                        >
                            <Edit3 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* C1 — Inline edit form */}
            {editing && (
                <div className="px-4 py-3 border-b border-slate-200 dark:border-white/8 flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/40">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Editar Cliente</p>
                    <input
                        placeholder="Nome *"
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-white/10 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex gap-2">
                        <select
                            value={editForm.type}
                            onChange={e => setEditForm(f => ({ ...f, type: e.target.value as 'PERSON' | 'COMPANY' }))}
                            className="flex-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-white/10 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="PERSON">Pessoa Física</option>
                            <option value="COMPANY">Empresa</option>
                        </select>
                        <select
                            value={editForm.status}
                            onChange={e => setEditForm(f => ({ ...f, status: e.target.value as 'LEAD' | 'ACTIVE' | 'INACTIVE' }))}
                            className="flex-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-white/10 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="LEAD">Lead</option>
                            <option value="ACTIVE">Ativo</option>
                            <option value="INACTIVE">Inativo</option>
                        </select>
                    </div>
                    <input
                        placeholder="CPF/CNPJ (somente números)"
                        value={editForm.cpfCnpj}
                        onChange={e => setEditForm(f => ({ ...f, cpfCnpj: e.target.value }))}
                        className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-white/10 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                        placeholder="E-mail"
                        value={editForm.emailPrimary}
                        onChange={e => setEditForm(f => ({ ...f, emailPrimary: e.target.value }))}
                        className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-white/10 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                        placeholder="Telefone principal"
                        value={editForm.phonePrimary}
                        onChange={e => setEditForm(f => ({ ...f, phonePrimary: e.target.value }))}
                        className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-white/10 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                        placeholder="Origem"
                        value={editForm.origin}
                        onChange={e => setEditForm(f => ({ ...f, origin: e.target.value }))}
                        className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-white/10 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <textarea
                        placeholder="Observações"
                        value={editForm.notes}
                        onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                        rows={2}
                        className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-white/10 rounded px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleSaveEdit}
                            disabled={saving || !editForm.name.trim()}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-primary text-white rounded py-1.5 hover:bg-primary/90 disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Salvar
                        </button>
                        <button
                            onClick={() => setEditing(false)}
                            className="px-3 text-xs bg-slate-200 dark:bg-slate-700 rounded py-1.5 hover:opacity-70"
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Seção: Informações */}
            <SectionHeader label="Informações" expanded={sections.info} onToggle={() => toggleSection('info')} />
            {sections.info && (
                <div className="px-4 pb-3 flex flex-col gap-2">
                    {customer.phonePrimary && (
                        <InfoRow icon={<Phone size={13} />} label="Telefone" value={customer.phonePrimary} />
                    )}
                    {customer.emailPrimary && (
                        <InfoRow icon={<Mail size={13} />} label="E-mail" value={customer.emailPrimary} />
                    )}
                    {customer.cpfCnpj && (
                        <InfoRow icon={<CreditCard size={13} />} label="CPF/CNPJ" value={customer.cpfCnpj} />
                    )}
                    {customer.origin && (
                        <InfoRow icon={<Globe size={13} />} label="Origem" value={customer.origin} />
                    )}
                    {customer.notes && (
                        <div className="mt-1">
                            <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Observações</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                {customer.notes}
                            </p>
                        </div>
                    )}
                    {!customer.phonePrimary && !customer.emailPrimary && !customer.cpfCnpj && !customer.origin && !customer.notes && (
                        <p className="text-xs text-slate-400 italic">Sem informações adicionais</p>
                    )}
                </div>
            )}

            {/* Seção: Contatos vinculados */}
            <SectionHeader
                label={`Canais (${customer.contacts?.length ?? 0})`}
                expanded={sections.contacts}
                onToggle={() => toggleSection('contacts')}
            />
            {sections.contacts && (
                <div className="px-4 pb-3 flex flex-col gap-2">
                    {customer.contacts && customer.contacts.length > 0 ? (
                        customer.contacts.map(c => (
                            <div key={c.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2.5 py-2">
                                <Phone size={12} className="text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{c.name || c.phoneNumber}</p>
                                    {c.name && <p className="text-[10px] text-slate-400">{c.phoneNumber}</p>}
                                </div>
                                {c.riskScore > 60 && (
                                    <span className="text-[10px] text-red-500 font-semibold">⚠ Risco</span>
                                )}
                                {/* C3 — Unlink contact */}
                                <button
                                    onClick={() => handleUnlinkContact(c.id)}
                                    title="Desvincular contato"
                                    className="p-1 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                                >
                                    <Link2Off size={12} />
                                </button>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-400 italic">Nenhum canal vinculado</p>
                    )}
                </div>
            )}

            {/* Seção: Tags */}
            <SectionHeader
                label={`Tags (${customer.tags?.length ?? 0})`}
                expanded={sections.tags}
                onToggle={() => toggleSection('tags')}
            />
            {sections.tags && (
                <div className="px-4 pb-3">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {customer.tags && customer.tags.length > 0 && customer.tags.map(t => (
                            <span
                                key={t.tagId}
                                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: t.tag.color }}
                            >
                                {t.tag.name}
                                <button onClick={() => handleRemoveTag(t.tagId)} className="hover:opacity-70">
                                    <X size={10} />
                                </button>
                            </span>
                        ))}
                        {(!customer.tags || customer.tags.length === 0) && (
                            <p className="text-xs text-slate-400 italic">Nenhuma tag</p>
                        )}
                    </div>
                    {/* C2 — Tag picker */}
                    <div className="relative" ref={tagPickerRef}>
                        <button
                            onClick={() => setShowTagPicker(p => !p)}
                            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                            <Plus size={12} /> Adicionar tag
                        </button>
                        {showTagPicker && (
                            <div className="absolute top-6 left-0 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg min-w-[160px] max-h-48 overflow-y-auto py-1">
                                {availableTags.length === 0 ? (
                                    <p className="text-xs text-slate-400 px-3 py-2 italic">Nenhuma tag disponível</p>
                                ) : availableTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => handleAddTag(tag)}
                                        disabled={addingTag}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5 text-left"
                                    >
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                                        {tag.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Seção: Notas Internas */}
            <SectionHeader label="Notas Internas" expanded={sections.notes} onToggle={() => toggleSection('notes')} />
            {sections.notes && (
                <div className="px-4 pb-3 flex flex-col gap-2">
                    {/* Input nova nota */}
                    <div className="flex gap-1.5">
                        <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Adicionar nota..."
                            rows={2}
                            className="flex-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                            onClick={handleAddNote}
                            disabled={!noteText.trim() || addingNote}
                            className="px-2 py-1.5 bg-primary text-white rounded-lg disabled:opacity-40 hover:bg-primary/90 self-end"
                        >
                            {addingNote ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        </button>
                    </div>
                    {/* Lista de notas */}
                    {customer.customerNotes && customer.customerNotes.length > 0 ? (
                        customer.customerNotes.map(note => (
                            <div key={note.id} className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-lg px-3 py-2">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-semibold text-yellow-700 dark:text-yellow-400">
                                        {note.agent?.name}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-slate-400">
                                            {format(new Date(note.createdAt), 'dd/MM HH:mm', { locale: ptBR })}
                                        </span>
                                        <button
                                            onClick={() => handleRemoveNote(note.id)}
                                            className="text-slate-400 hover:text-red-500"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                                    {note.note}
                                </p>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-400 italic">Nenhuma nota registrada</p>
                    )}
                </div>
            )}

            {/* Seção: Campos Customizados */}
            <SectionHeader label="Campos Extras" expanded={sections.fields} onToggle={() => toggleSection('fields')} />
            {sections.fields && (
                <div className="px-4 pb-3 flex flex-col gap-2">
                    {customer.customFields && customer.customFields.length > 0 && (
                        customer.customFields.map(f => (
                            <div key={f.id} className="flex items-start gap-2 justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-slate-400 uppercase font-semibold">{f.fieldName}</p>
                                    <p className="text-xs text-slate-700 dark:text-slate-300 break-words">{f.fieldValue}</p>
                                </div>
                                <button
                                    onClick={() => handleRemoveField(f.fieldName)}
                                    className="text-slate-300 hover:text-red-500 flex-shrink-0 mt-0.5"
                                >
                                    <Trash2 size={11} />
                                </button>
                            </div>
                        ))
                    )}
                    {/* Formulário novo campo */}
                    {addingField ? (
                        <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5">
                            <input
                                placeholder="Nome do campo"
                                value={newField.name}
                                onChange={e => setNewField(f => ({ ...f, name: e.target.value }))}
                                className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-white/10 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <input
                                placeholder="Valor"
                                value={newField.value}
                                onChange={e => setNewField(f => ({ ...f, value: e.target.value }))}
                                className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-white/10 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <div className="flex gap-1.5">
                                <button
                                    onClick={handleAddField}
                                    className="flex-1 text-xs bg-primary text-white rounded py-1 hover:bg-primary/90"
                                >
                                    Salvar
                                </button>
                                <button
                                    onClick={() => setAddingField(false)}
                                    className="px-2 text-xs bg-slate-200 dark:bg-slate-700 rounded py-1 hover:opacity-70"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setAddingField(true)}
                            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                            <Plus size={12} /> Adicionar campo
                        </button>
                    )}
                </div>
            )}

            {/* Seção: Histórico de Conversas */}
            <SectionHeader label="Histórico" expanded={sections.history} onToggle={() => toggleSection('history')} />
            {sections.history && (
                <div className="px-4 pb-4 flex flex-col gap-2">
                    {loadingHistory ? (
                        <div className="flex justify-center py-4">
                            <Loader2 size={16} className="animate-spin text-primary" />
                        </div>
                    ) : conversations.length > 0 ? (
                        conversations.map(conv => (
                            <div
                                key={conv.id}
                                className="flex flex-col gap-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                                onClick={() => onNavigateToTicket?.(conv.id)}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                        {conv.department?.emoji} {conv.department?.name}
                                    </span>
                                    <StatusBadge status={conv.status} />
                                </div>
                                <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
                                    {conv.subject || 'Sem assunto'}
                                </p>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">
                                        {format(new Date(conv.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        {conv._count?.messages ?? 0} msgs
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-slate-400 italic">Nenhuma conversa encontrada</p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function SectionHeader({ label, expanded, onToggle }: { label: string; expanded: boolean; onToggle: () => void }) {
    return (
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-white/4 transition-colors border-b border-slate-100 dark:border-white/5"
        >
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
            </span>
            {expanded ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
        </button>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-start gap-2">
            <span className="text-slate-400 mt-0.5 flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">{label}</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 break-all">{value}</p>
            </div>
        </div>
    );
}

const TICKET_STATUS_COLORS: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    IN_PROGRESS: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    CANCELLED: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    WAITING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    PAUSED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const TICKET_STATUS_LABELS: Record<string, string> = {
    OPEN: 'Aberto',
    IN_PROGRESS: 'Em atendimento',
    RESOLVED: 'Resolvido',
    CANCELLED: 'Cancelado',
    WAITING: 'Aguardando',
    PAUSED: 'Pausado',
};

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${TICKET_STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-500'}`}>
            {TICKET_STATUS_LABELS[status] ?? status}
        </span>
    );
}
