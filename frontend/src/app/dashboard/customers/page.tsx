'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Contact2, Plus, Search, X, ChevronDown, Users, Building2, Loader2,
    Phone, Mail, CreditCard, Tag, Star, Merge, Edit3, Trash2, ChevronLeft,
    ChevronRight, Filter, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { customersService, Customer } from '@/services/customers';
import CustomerProfilePanel from '@/components/customers/CustomerProfilePanel';

const STATUS_OPTIONS = [
    { value: '', label: 'Todos os status' },
    { value: 'LEAD', label: 'Lead' },
    { value: 'ACTIVE', label: 'Ativo' },
    { value: 'INACTIVE', label: 'Inativo' },
];

const TYPE_LABELS: Record<string, string> = {
    PERSON: 'Pessoa Física',
    COMPANY: 'Pessoa Jurídica',
};

const STATUS_COLORS: Record<string, string> = {
    LEAD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    INACTIVE: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const EMPTY_FORM = {
    name: '',
    type: 'PERSON' as 'PERSON' | 'COMPANY',
    cpfCnpj: '',
    emailPrimary: '',
    phonePrimary: '',
    status: 'ACTIVE' as 'LEAD' | 'ACTIVE' | 'INACTIVE',
    origin: '',
    notes: '',
};

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const search = useDebounce(searchInput, 400);
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);

    // Seleção / painel lateral
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

    // Modal criar/editar
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    // Modal de merge
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [mergeSource, setMergeSource] = useState<Customer | null>(null);
    const [mergeTargetSearch, setMergeTargetSearch] = useState('');
    const [mergeTargets, setMergeTargets] = useState<Customer[]>([]);
    const [mergeTarget, setMergeTarget] = useState<Customer | null>(null);
    const [merging, setMerging] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await customersService.findAll({ search, status: statusFilter || undefined, page, limit: 20 });
            setCustomers(res.data);
            setTotal(res.total);
            setLastPage(res.lastPage);
        } catch {
            toast.error('Erro ao carregar clientes');
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter, page]);

    useEffect(() => { load(); }, [load]);

    // Reseta página quando busca muda
    useEffect(() => { setPage(1); }, [search]);

    const handleSearchChange = (v: string) => {
        setSearchInput(v);
    };

    const openCreate = () => {
        setEditingCustomer(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    };

    const openEdit = (c: Customer) => {
        setEditingCustomer(c);
        setForm({
            name: c.name,
            type: c.type,
            cpfCnpj: c.cpfCnpj || '',
            emailPrimary: c.emailPrimary || '',
            phonePrimary: c.phonePrimary || '',
            status: c.status,
            origin: c.origin || '',
            notes: c.notes || '',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
        setSaving(true);
        try {
            const payload = {
                ...form,
                cpfCnpj: form.cpfCnpj.replace(/\D/g, '') || undefined,
                phonePrimary: form.phonePrimary || undefined,
                emailPrimary: form.emailPrimary || undefined,
                origin: form.origin || undefined,
                notes: form.notes || undefined,
            };
            if (editingCustomer) {
                await customersService.update(editingCustomer.id, payload);
                toast.success('Cliente atualizado');
            } else {
                await customersService.create(payload);
                toast.success('Cliente criado');
            }
            setShowModal(false);
            load();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || 'Erro ao salvar cliente');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (c: Customer) => {
        if (!confirm(`Excluir o cliente "${c.name}"? Os contatos vinculados serão desassociados.`)) return;
        try {
            await customersService.remove(c.id);
            toast.success('Cliente excluído');
            if (selectedCustomer?.id === c.id) setSelectedCustomer(null);
            load();
        } catch {
            toast.error('Erro ao excluir cliente');
        }
    };

    const openMerge = (source: Customer) => {
        setMergeSource(source);
        setMergeTarget(null);
        setMergeTargetSearch('');
        setMergeTargets([]);
        setShowMergeModal(true);
    };

    const searchMergeTargets = async (q: string) => {
        setMergeTargetSearch(q);
        if (q.length < 2) { setMergeTargets([]); return; }
        try {
            const res = await customersService.findAll({ search: q, limit: 5 });
            setMergeTargets(res.data.filter(c => c.id !== mergeSource?.id));
        } catch { /* ignore */ }
    };

    const handleMerge = async () => {
        if (!mergeSource || !mergeTarget) return;
        setMerging(true);
        try {
            await customersService.merge(mergeSource.id, mergeTarget.id);
            toast.success(`"${mergeSource.name}" mesclado em "${mergeTarget.name}"`);
            setShowMergeModal(false);
            if (selectedCustomer?.id === mergeSource.id) setSelectedCustomer(null);
            load();
        } catch {
            toast.error('Erro ao mesclar clientes');
        } finally {
            setMerging(false);
        }
    };

    const selectCustomer = async (c: Customer) => {
        setSelectedCustomer(c);
        // Busca o primeiro contato para o painel
        const contacts = c.contacts && c.contacts.length > 0 ? c.contacts : [];
        if (contacts.length > 0) {
            setSelectedContactId(contacts[0].id);
        } else {
            // Busca contatos do customer se não foram carregados
            try {
                const detail = await customersService.findOne(c.id);
                const firstContact = detail.contacts?.[0];
                setSelectedContactId(firstContact?.id || null);
                setSelectedCustomer(detail);
            } catch { setSelectedContactId(null); }
        }
    };

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-950">
            {/* ─── Lista principal ────────────────────────────────────────── */}
            <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${selectedCustomer ? 'max-w-[calc(100%-360px)]' : 'max-w-full'}`}>
                {/* Header */}
                <div className="px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/8 flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Contact2 size={22} className="text-primary" /> Clientes
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">{total} cliente{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
                    >
                        <Plus size={16} /> Novo Cliente
                    </button>
                </div>

                {/* Filters */}
                <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/8 flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchInput}
                            onChange={e => handleSearchChange(e.target.value)}
                            placeholder="Buscar por nome, telefone, email, CPF/CNPJ..."
                            className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        {searchInput && (
                            <button onClick={() => handleSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                            className="appearance-none pl-3 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                        >
                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Customer list */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={28} className="animate-spin text-primary" />
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
                            <Contact2 size={40} strokeWidth={1.5} />
                            <p className="text-sm">Nenhum cliente encontrado</p>
                            <button onClick={openCreate} className="text-xs text-primary hover:underline">
                                Criar primeiro cliente
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {customers.map(customer => (
                                <CustomerCard
                                    key={customer.id}
                                    customer={customer}
                                    selected={selectedCustomer?.id === customer.id}
                                    onClick={() => selectCustomer(customer)}
                                    onEdit={() => openEdit(customer)}
                                    onDelete={() => handleDelete(customer)}
                                    onMerge={() => openMerge(customer)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {lastPage > 1 && (
                        <div className="flex items-center justify-center gap-3 mt-6">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <ChevronLeft size={15} />
                            </button>
                            <span className="text-sm text-slate-500">{page} / {lastPage}</span>
                            <button
                                onClick={() => setPage(p => Math.min(lastPage, p + 1))}
                                disabled={page === lastPage}
                                className="p-2 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Painel lateral ─────────────────────────────────────────── */}
            <AnimatePresence>
                {selectedCustomer && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                        className="w-[360px] flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/8 flex flex-col overflow-hidden"
                    >
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-white/8 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Contact2 size={16} className="text-primary" />
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Perfil do Cliente</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => openEdit(selectedCustomer)}
                                    title="Editar"
                                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                >
                                    <Edit3 size={14} />
                                </button>
                                <button
                                    onClick={() => setSelectedCustomer(null)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {selectedContactId ? (
                                <CustomerProfilePanel
                                    contactId={selectedContactId}
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-10 text-slate-400 text-sm">
                                    <Phone size={22} strokeWidth={1.5} />
                                    <span>Nenhum contato vinculado</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Modal Criar/Editar ──────────────────────────────────────── */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-white/10 overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/8 flex items-center justify-between">
                                <h2 className="font-black text-slate-900 dark:text-white">
                                    {editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}
                                </h2>
                                <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                                {/* Nome */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nome *</label>
                                    <input
                                        value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="Nome completo ou razão social"
                                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>

                                {/* Tipo + Status */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tipo</label>
                                        <select
                                            value={form.type}
                                            onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        >
                                            <option value="PERSON">Pessoa Física</option>
                                            <option value="COMPANY">Pessoa Jurídica</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Status</label>
                                        <select
                                            value={form.status}
                                            onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        >
                                            <option value="LEAD">Lead</option>
                                            <option value="ACTIVE">Ativo</option>
                                            <option value="INACTIVE">Inativo</option>
                                        </select>
                                    </div>
                                </div>

                                {/* CPF/CNPJ */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                                        {form.type === 'PERSON' ? 'CPF' : 'CNPJ'}
                                    </label>
                                    <input
                                        value={form.cpfCnpj}
                                        onChange={e => setForm(f => ({ ...f, cpfCnpj: e.target.value }))}
                                        placeholder={form.type === 'PERSON' ? '000.000.000-00' : '00.000.000/0000-00'}
                                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>

                                {/* Telefone + Email */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Telefone principal</label>
                                        <input
                                            value={form.phonePrimary}
                                            onChange={e => setForm(f => ({ ...f, phonePrimary: e.target.value }))}
                                            placeholder="5511999999999"
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">E-mail</label>
                                        <input
                                            type="email"
                                            value={form.emailPrimary}
                                            onChange={e => setForm(f => ({ ...f, emailPrimary: e.target.value }))}
                                            placeholder="email@exemplo.com"
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                </div>

                                {/* Origem */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Origem</label>
                                    <input
                                        value={form.origin}
                                        onChange={e => setForm(f => ({ ...f, origin: e.target.value }))}
                                        placeholder="Ex: WhatsApp, Indicação, Instagram..."
                                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>

                                {/* Observações */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Observações</label>
                                    <textarea
                                        value={form.notes}
                                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                        rows={3}
                                        placeholder="Observações gerais sobre o cliente..."
                                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                    />
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-slate-200 dark:border-white/8 flex justify-end gap-2">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-5 py-2 text-sm bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <Loader2 size={13} className="animate-spin" />}
                                    {editingCustomer ? 'Salvar alterações' : 'Criar cliente'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Modal Mesclar ───────────────────────────────────────────── */}
            <AnimatePresence>
                {showMergeModal && mergeSource && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={e => { if (e.target === e.currentTarget) setShowMergeModal(false); }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-white/10"
                        >
                            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/8">
                                <h2 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    <Merge size={18} className="text-primary" /> Mesclar Clientes
                                </h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    "{mergeSource.name}" será fundido no cliente selecionado. Os contatos e dados serão migrados para o destino.
                                </p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mesclar COM (destino)</label>
                                    <input
                                        value={mergeTargetSearch}
                                        onChange={e => searchMergeTargets(e.target.value)}
                                        placeholder="Buscar cliente destino..."
                                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                    {mergeTargets.length > 0 && (
                                        <div className="mt-1 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                                            {mergeTargets.map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => { setMergeTarget(t); setMergeTargets([]); setMergeTargetSearch(t.name); }}
                                                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 ${mergeTarget?.id === t.id ? 'bg-primary/5 text-primary' : ''}`}
                                                >
                                                    <Contact2 size={14} />
                                                    <span className="flex-1 truncate">{t.name}</span>
                                                    <span className="text-xs text-slate-400">{t.phonePrimary}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {mergeTarget && (
                                        <div className="mt-2 p-2.5 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-2">
                                            <Contact2 size={14} className="text-primary" />
                                            <span className="text-sm font-semibold text-primary flex-1">{mergeTarget.name}</span>
                                            <button onClick={() => setMergeTarget(null)} className="text-primary/50 hover:text-primary">
                                                <X size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-slate-200 dark:border-white/8 flex justify-end gap-2">
                                <button onClick={() => setShowMergeModal(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleMerge}
                                    disabled={!mergeTarget || merging}
                                    className="px-5 py-2 text-sm bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {merging && <Loader2 size={13} className="animate-spin" />}
                                    Mesclar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── CustomerCard ─────────────────────────────────────────────────────────────

interface CustomerCardProps {
    customer: Customer;
    selected: boolean;
    onClick: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onMerge: () => void;
}

function CustomerCard({ customer, selected, onClick, onEdit, onDelete, onMerge }: CustomerCardProps) {
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div
            onClick={onClick}
            className={`relative group cursor-pointer rounded-2xl border p-4 transition-all ${selected
                ? 'border-primary/40 bg-primary/5 shadow-md shadow-primary/10'
                : 'border-slate-200 dark:border-white/8 bg-white dark:bg-slate-900 hover:border-primary/20 hover:shadow-sm'
                }`}
        >
            {/* Menu de ações */}
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="relative">
                    <button
                        onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg"
                    >
                        <ChevronDown size={13} />
                    </button>
                    {showMenu && (
                        <div
                            className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-10 py-1"
                            onClick={e => e.stopPropagation()}
                        >
                            <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300">
                                <Edit3 size={12} /> Editar
                            </button>
                            <button onClick={() => { onMerge(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300">
                                <Merge size={12} /> Mesclar
                            </button>
                            <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500">
                                <Trash2 size={12} /> Excluir
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Avatar + nome */}
            <div className="flex items-start gap-3 pr-6">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${selected ? 'bg-primary/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    {customer.type === 'COMPANY'
                        ? <Building2 size={18} className={selected ? 'text-primary' : 'text-slate-400'} />
                        : <Contact2 size={18} className={selected ? 'text-primary' : 'text-slate-400'} />
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{customer.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[customer.status]}`}>
                            {customer.status === 'LEAD' ? 'Lead' : customer.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                        </span>
                        <span className="text-[10px] text-slate-400">{TYPE_LABELS[customer.type]}</span>
                    </div>
                </div>
            </div>

            {/* Info rápida */}
            <div className="mt-3 space-y-1">
                {customer.phonePrimary && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Phone size={11} /> {customer.phonePrimary}
                    </div>
                )}
                {customer.emailPrimary && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                        <Mail size={11} /> {customer.emailPrimary}
                    </div>
                )}
            </div>

            {/* Footer: canais + tags */}
            <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Users size={11} /> {customer._count?.contacts ?? customer.contacts?.length ?? 0} canal{(customer._count?.contacts ?? customer.contacts?.length ?? 0) !== 1 ? 'is' : ''}
                </span>
                {customer.tags && customer.tags.length > 0 && (
                    <div className="flex gap-1">
                        {customer.tags.slice(0, 3).map(t => (
                            <span
                                key={t.tagId}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: t.tag.color }}
                            >
                                {t.tag.name}
                            </span>
                        ))}
                        {customer.tags.length > 3 && (
                            <span className="text-[10px] text-slate-400">+{customer.tags.length - 3}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
