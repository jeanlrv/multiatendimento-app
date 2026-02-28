'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, ShieldCheck, ShieldPlus, Edit2, Trash2, X, Save,
    RefreshCcw, Search, ChevronDown, ChevronRight, Users,
    Lock, Unlock, CheckSquare, Square, Zap, ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { rolesService, Role, CreateRolePayload, UpdateRolePayload } from '@/services/roles';
import { PERMISSION_GROUPS, ALL_PERMISSION_KEYS, hasPermission, isAdmin } from '@/lib/permissions';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const PROTECTED_NAMES = ['ADMIN', 'ADMINISTRADOR', 'ADMINISTRADOR GLOBAL'];
const isProtected = (name: string) =>
    PROTECTED_NAMES.some(p => name.toUpperCase().includes(p));

const ROLE_PALETTE = [
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-indigo-600',
    'from-violet-500 to-purple-600',
    'from-cyan-500 to-sky-600',
];

const getRoleGradient = (name: string) => {
    const idx = name.charCodeAt(0) % ROLE_PALETTE.length;
    return ROLE_PALETTE[idx];
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RolesPage() {
    const { user } = useAuth();
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDrawer, setShowDrawer] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const canCreate = hasPermission(user, 'roles:create');
    const canEdit = hasPermission(user, 'roles:update');
    const canDelete = hasPermission(user, 'roles:delete');

    useEffect(() => { fetchRoles(); }, []);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const data = await rolesService.findAll();
            setRoles(data);
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Erro ao carregar perfis de acesso';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const filteredRoles = useMemo(() =>
        roles.filter(r =>
            r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.description ?? '').toLowerCase().includes(searchTerm.toLowerCase())
        ),
        [roles, searchTerm]
    );

    const handleDelete = async (role: Role) => {
        if (isProtected(role.name)) {
            toast.error('O perfil de administrador é protegido e não pode ser excluído.');
            return;
        }
        if (!confirm(`Excluir o perfil "${role.name}"? Esta ação não pode ser desfeita.`)) return;

        setDeletingId(role.id);
        try {
            await rolesService.remove(role.id);
            setRoles(prev => prev.filter(r => r.id !== role.id));
            toast.success('Perfil removido com sucesso');
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Erro ao remover perfil';
            toast.error(msg);
        } finally {
            setDeletingId(null);
        }
    };

    const openCreate = () => { setEditingRole(null); setShowDrawer(true); };
    const openEdit = (role: Role) => { setEditingRole(role); setShowDrawer(true); };

    if (showDrawer) {
        return (
            <div className="space-y-10 max-w-7xl mx-auto pb-12 relative liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] pt-6">
                <RoleFormView
                    key={editingRole?.id ?? 'new'}
                    role={editingRole}
                    onClose={() => setShowDrawer(false)}
                    onSave={(saved) => {
                        if (editingRole) {
                            setRoles(prev => prev.map(r => r.id === saved.id ? saved : r));
                        } else {
                            setRoles(prev => [...prev, saved]);
                        }
                        setShowDrawer(false);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-10 max-w-7xl mx-auto pb-12 relative liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-4">
                        <Shield className="text-primary h-10 w-10 shadow-[0_0_20px_rgba(56,189,248,0.3)]" />
                        Perfis de <span className="text-primary italic">Acesso</span>
                    </h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 italic">
                        Gerencie permissões granulares por perfil · KSZap RBAC
                    </p>
                </div>
                {canCreate && (
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-[1.5rem] shadow-2xl shadow-primary/30 font-bold text-xs uppercase tracking-widest group active:scale-95 transition-all"
                    >
                        <ShieldPlus className="h-5 w-5 group-hover:scale-110 transition-transform" />
                        <span className="hidden sm:inline">Novo Perfil</span>
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 px-4">
                {[
                    { label: 'Total de Perfis', value: roles.length, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
                    { label: 'Protegidos', value: roles.filter(r => isProtected(r.name)).length, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20' },
                    { label: 'Permissões (total)', value: ALL_PERMISSION_KEYS.length, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                ].map(m => (
                    <div key={m.label} className={`liquid-glass rounded-[2rem] p-6 border ${m.bg} flex flex-col items-center justify-center gap-1`}>
                        <span className={`text-3xl font-black ${m.color}`}>{m.value}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{m.label}</span>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="px-4">
                <div className="relative group max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar perfil..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-5 py-3.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all dark:text-white"
                    />
                </div>
            </div>

            {/* Grid de roles */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-64 liquid-glass rounded-[2.5rem] animate-pulse" />)}
                </div>
            ) : filteredRoles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                    <Shield size={48} className="mb-4 opacity-20" />
                    <p className="font-bold text-sm">
                        {roles.length === 0 ? 'Nenhum perfil encontrado.' : 'Nenhum perfil corresponde à busca.'}
                    </p>
                    {roles.length === 0 && canCreate && (
                        <button
                            onClick={openCreate}
                            className="mt-4 px-6 py-3 bg-primary text-white rounded-2xl font-bold text-xs uppercase tracking-widest"
                        >
                            Criar primeiro perfil
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                    <AnimatePresence mode="popLayout">
                        {filteredRoles.map((role, index) => (
                            <motion.div
                                key={role.id}
                                layout
                                initial={{ opacity: 0, scale: 0.93, y: 16 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.93 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                className="liquid-glass p-8 rounded-[2.5rem] border border-white/80 dark:border-white/10 shadow-xl group relative overflow-hidden transition-all"
                            >
                                {/* Actions overlay */}
                                <div className="absolute top-5 right-5 flex gap-2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-200 z-10">
                                    {canEdit && (
                                        <button
                                            onClick={() => openEdit(role)}
                                            title="Editar perfil"
                                            className="h-9 w-9 flex items-center justify-center bg-white dark:bg-white/10 rounded-xl shadow-lg text-slate-500 hover:text-primary hover:bg-primary/10 transition-all border border-slate-100 dark:border-white/10 active:scale-90"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                    )}
                                    {canDelete && !isProtected(role.name) && (
                                        <button
                                            onClick={() => handleDelete(role)}
                                            disabled={deletingId === role.id}
                                            title="Excluir perfil"
                                            className="h-9 w-9 flex items-center justify-center bg-white dark:bg-white/10 rounded-xl shadow-lg text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-slate-100 dark:border-white/10 active:scale-90"
                                        >
                                            {deletingId === role.id
                                                ? <RefreshCcw size={14} className="animate-spin" />
                                                : <Trash2 size={14} />
                                            }
                                        </button>
                                    )}
                                </div>

                                {/* Icon + Name */}
                                <div className="flex items-center gap-5 mb-6">
                                    <div className={`h-16 w-16 rounded-[1.5rem] bg-gradient-to-br ${getRoleGradient(role.name)} flex items-center justify-center text-white shadow-xl group-hover:rotate-3 transition-transform shrink-0`}>
                                        {isProtected(role.name)
                                            ? <Lock size={24} />
                                            : <Shield size={24} />
                                        }
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-lg text-slate-900 dark:text-white truncate tracking-tight leading-tight">
                                            {role.name}
                                        </h3>
                                        {isProtected(role.name) && (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest mt-1">
                                                <Lock size={8} /> Protegido
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Description */}
                                {role.description && (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-5 leading-relaxed line-clamp-2">
                                        {role.description}
                                    </p>
                                )}

                                {/* Permission count */}
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={14} className="text-primary" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                            {role.permissions.length} permissão{role.permissions.length !== 1 ? 'ões' : ''}
                                        </span>
                                    </div>
                                    {role._count !== undefined && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                            <Users size={12} />
                                            {role._count.users} usuário{role._count.users !== 1 ? 's' : ''}
                                        </div>
                                    )}
                                </div>

                                {/* Mini permission preview */}
                                {role.permissions.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-4">
                                        {role.permissions.slice(0, 5).map(p => (
                                            <span key={p} className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                                                {p.split(':')[0]}
                                            </span>
                                        ))}
                                        {role.permissions.length > 5 && (
                                            <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                                                +{role.permissions.length - 5}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

        </div>
    );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

interface DrawerProps {
    role: Role | null;
    onClose: () => void;
    onSave: (role: Role) => void;
}

function RoleFormView({ role, onClose, onSave }: DrawerProps) {
    const isNew = !role;
    const [submitting, setSubmitting] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(PERMISSION_GROUPS.map(g => g.group)));

    const [form, setForm] = useState({
        name: role?.name ?? '',
        description: role?.description ?? '',
        permissions: new Set<string>(role?.permissions ?? []),
    });

    // Re-sincroniza o form se o role prop mudar (segurança extra além do key)
    useEffect(() => {
        setForm({
            name: role?.name ?? '',
            description: role?.description ?? '',
            permissions: new Set<string>(role?.permissions ?? []),
        });
    }, [role?.id]);

    const totalSelected = form.permissions.size;
    const isAdminRole = !isNew && isProtected(role.name);

    const togglePermission = (key: string) => {
        if (isAdminRole) return; // admin permissions não são editáveis
        setForm(prev => {
            const next = new Set(prev.permissions);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return { ...prev, permissions: next };
        });
    };

    const toggleGroup = (groupItems: string[]) => {
        if (isAdminRole) return;
        setForm(prev => {
            const next = new Set(prev.permissions);
            const allSelected = groupItems.every(k => next.has(k));
            if (allSelected) groupItems.forEach(k => next.delete(k));
            else groupItems.forEach(k => next.add(k));
            return { ...prev, permissions: next };
        });
    };

    const selectAll = () => {
        if (isAdminRole) return;
        setForm(prev => ({ ...prev, permissions: new Set(ALL_PERMISSION_KEYS) }));
    };

    const clearAll = () => {
        if (isAdminRole) return;
        setForm(prev => ({ ...prev, permissions: new Set() }));
    };

    const toggleGroupExpand = (group: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Nome do perfil é obrigatório'); return; }

        setSubmitting(true);
        try {
            const payload = {
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                permissions: Array.from(form.permissions),
            };

            let result: Role;
            if (isNew) {
                result = await rolesService.create(payload as CreateRolePayload);
                toast.success('Perfil criado com sucesso!');
            } else {
                result = await rolesService.update(role.id, payload as UpdateRolePayload);
                toast.success('Perfil atualizado!');
            }
            onSave(result);
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Erro ao salvar perfil';
            toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-4xl mx-auto liquid-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-white/10 shadow-2xl flex flex-col"
        >
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center text-3xl md:text-4xl shadow-lg shadow-primary/10 transition-colors text-white bg-primary">
                        {isAdminRole ? <Lock className="h-6 w-6 md:h-8 md:w-8" /> : <Shield className="h-6 w-6 md:h-8 md:w-8" />}
                    </div>
                    <div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-xs font-black uppercase tracking-widest mb-1"
                        >
                            <ChevronLeft size={16} /> Voltar para Perfis
                        </button>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter italic leading-tight">
                            {isNew ? 'Novo' : 'Editar'} <span className="text-primary italic">Perfil</span>
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                            {isNew ? 'Defina nome e permissões' : `Editando: ${role.name}`}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 mt-4 md:mt-0 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all hidden md:block"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit as any}
                        disabled={submitting || isAdminRole}
                        className="flex-1 md:flex-none px-8 py-3 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {submitting ? <RefreshCcw className="animate-spin h-4 w-4" /> : <Save className="w-4 h-4" />}
                        {isNew ? 'Criar Perfil' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>

            {/* Counter badge */}
            <div className="px-8 py-3 bg-primary/5 border-b border-primary/10 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Permissões selecionadas
                </span>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-primary">
                        {totalSelected} / {ALL_PERMISSION_KEYS.length}
                    </span>
                    {!isAdminRole && (
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={selectAll}
                                className="text-[9px] font-black px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
                            >
                                <Zap size={10} className="inline mr-1" />
                                Acesso Total
                            </button>
                            <button
                                type="button"
                                onClick={clearAll}
                                className="text-[9px] font-black px-3 py-1 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
                            >
                                Limpar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Nome */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Perfil *</label>
                        <input
                            required
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            disabled={isAdminRole}
                            className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold dark:text-white transition-all disabled:opacity-60"
                            placeholder="Ex: Atendente Jr."
                        />
                    </div>

                    {/* Descrição */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                        <input
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            disabled={isAdminRole}
                            className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold dark:text-white transition-all disabled:opacity-60"
                            placeholder="Breve descrição do perfil (opcional)"
                        />
                    </div>

                    {/* Aviso admin protegido */}
                    {isAdminRole && (
                        <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                            <Lock size={16} className="text-rose-500 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold leading-relaxed">
                                Este é o perfil de administrador do sistema. Ele possui acesso total e suas permissões são protegidas automaticamente pelo sistema.
                            </p>
                        </div>
                    )}

                    {/* Permissões por grupos */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Shield size={11} className="text-primary" /> Permissões por Módulo
                        </label>

                        {PERMISSION_GROUPS.map(group => {
                            const groupKeys = group.items.map(i => i.key);
                            const selectedInGroup = groupKeys.filter(k => form.permissions.has(k)).length;
                            const allGroupSelected = selectedInGroup === groupKeys.length;
                            const someGroupSelected = selectedInGroup > 0 && !allGroupSelected;
                            const expanded = expandedGroups.has(group.group);

                            return (
                                <div key={group.group} className="border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
                                    {/* Group header */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-white/5">
                                        <button
                                            type="button"
                                            onClick={() => toggleGroupExpand(group.group)}
                                            className="flex items-center gap-3 flex-1 text-left"
                                        >
                                            <span className="text-lg">{group.icon}</span>
                                            <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                {group.group}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400 ml-auto mr-2">
                                                {selectedInGroup}/{groupKeys.length}
                                            </span>
                                            {expanded
                                                ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                                : <ChevronRight size={14} className="text-slate-400 shrink-0" />
                                            }
                                        </button>
                                        {/* Select all group */}
                                        {!isAdminRole && (
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(groupKeys)}
                                                className="ml-3 shrink-0"
                                                title={allGroupSelected ? 'Desmarcar todos' : 'Marcar todos'}
                                            >
                                                {allGroupSelected ? (
                                                    <CheckSquare size={18} className="text-primary" />
                                                ) : someGroupSelected ? (
                                                    <CheckSquare size={18} className="text-primary/40" />
                                                ) : (
                                                    <Square size={18} className="text-slate-300 dark:text-slate-600" />
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Group items */}
                                    <AnimatePresence initial={false}>
                                        {expanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="divide-y divide-slate-100 dark:divide-white/5"
                                            >
                                                {group.items.map(item => {
                                                    const checked = isAdminRole ? true : form.permissions.has(item.key);
                                                    return (
                                                        <label
                                                            key={item.key}
                                                            className={`flex items-center gap-4 px-5 py-3 ${isAdminRole ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-primary/5 transition-colors'}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => togglePermission(item.key)}
                                                                disabled={isAdminRole}
                                                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-0 accent-primary cursor-pointer disabled:cursor-not-allowed"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <span className={`text-[11px] font-black uppercase tracking-wide ${checked ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                                                                    {item.label}
                                                                </span>
                                                                <p className="text-[9px] text-slate-400 mt-0.5">{item.desc}</p>
                                                            </div>
                                                            <span className="text-[8px] font-mono text-slate-300 dark:text-slate-600 shrink-0">{item.key}</span>
                                                        </label>
                                                    );
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </form>
            </div>

        </motion.div>
    );
}
