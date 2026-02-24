'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, UserPlus, Mail, Shield, Building2, Edit2, Trash2, Key,
    X, Save, Search, RefreshCcw, ShieldCheck, Eye, EyeOff, Check,
    PowerOff, Power, ChevronDown, Filter, Copy, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { usersService, User, CreateUserPayload, UpdateUserPayload } from '@/services/users';

interface Role { id: string; name: string; description?: string }
interface Department { id: string; name: string; emoji?: string; color?: string }

const ROLE_COLORS: Record<string, string> = {
    ADMIN: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
    SUPERVISOR: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    AGENT: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    MANAGER: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

const getRoleColor = (name: string) =>
    ROLE_COLORS[name.toUpperCase()] ?? 'bg-primary/10 text-primary border-primary/20';

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDrawer, setShowDrawer] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
    const [filterRole, setFilterRole] = useState('');
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        const [usersResult, rolesResult, deptsResult] = await Promise.allSettled([
            usersService.findAll(),
            api.get('/roles'),
            api.get('/departments'),
        ]);

        if (usersResult.status === 'fulfilled') setUsers(usersResult.value);
        else toast.error('Erro ao carregar usuários');

        if (rolesResult.status === 'fulfilled') setRoles(rolesResult.value.data);
        if (deptsResult.status === 'fulfilled') setDepartments(deptsResult.value.data);

        setLoading(false);
    };

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchSearch =
                u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.role?.name?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus =
                filterStatus === 'ALL' ? true :
                filterStatus === 'ACTIVE' ? u.isActive :
                !u.isActive;
            const matchRole = filterRole ? u.roleId === filterRole : true;
            return matchSearch && matchStatus && matchRole;
        });
    }, [users, searchTerm, filterStatus, filterRole]);

    const metrics = useMemo(() => ({
        total: users.length,
        active: users.filter(u => u.isActive).length,
        inactive: users.filter(u => !u.isActive).length,
    }), [users]);

    const handleToggleStatus = async (user: User) => {
        setTogglingId(user.id);
        try {
            const updated = await usersService.toggleStatus(user.id, !user.isActive);
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: updated.isActive } : u));
            toast.success(`${user.name} ${updated.isActive ? 'ativado' : 'desativado'} com sucesso`);
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Erro ao alterar status';
            toast.error(msg);
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (user: User) => {
        if (!confirm(`Remover "${user.name}" permanentemente?`)) return;
        setDeletingId(user.id);
        try {
            await usersService.remove(user.id);
            setUsers(prev => prev.filter(u => u.id !== user.id));
            toast.success('Usuário removido');
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Erro ao remover usuário';
            toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
            setDeletingId(null);
        }
    };

    const openCreate = () => { setEditingUser(null); setShowDrawer(true); };
    const openEdit = (user: User) => { setEditingUser(user); setShowDrawer(true); };

    return (
        <div className="space-y-10 max-w-7xl mx-auto relative pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-4">
                        <Users className="text-primary h-10 w-10 shadow-[0_0_20px_rgba(56,189,248,0.3)]" />
                        Equipe <span className="text-primary italic">Aero</span>
                    </h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 italic">
                        Gestão de agentes e privilégios KSZap
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-[1.5rem] shadow-2xl shadow-primary/30 font-bold text-xs uppercase tracking-widest group active:scale-95 transition-all"
                >
                    <UserPlus className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="hidden sm:inline">Recrutar Agente</span>
                </button>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-4 px-4">
                {[
                    { label: 'Total', value: metrics.total, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
                    { label: 'Ativos', value: metrics.active, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                    { label: 'Inativos', value: metrics.inactive, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20' },
                ].map(m => (
                    <div key={m.label} className={`liquid-glass rounded-[2rem] p-6 border ${m.bg} flex flex-col items-center justify-center gap-1`}>
                        <span className={`text-3xl font-black ${m.color}`}>{m.value}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.label}</span>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4">
                <div className="relative group flex-1 max-w-xs">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar agente, email, role..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-5 py-3.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] text-xs font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all dark:text-white"
                    />
                </div>

                {/* Filtro de status */}
                <div className="flex items-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] p-1 gap-1">
                    {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}
                        >
                            {s === 'ALL' ? 'Todos' : s === 'ACTIVE' ? 'Ativos' : 'Inativos'}
                        </button>
                    ))}
                </div>

                {/* Filtro de role */}
                {roles.length > 0 && (
                    <div className="relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        <select
                            value={filterRole}
                            onChange={e => setFilterRole(e.target.value)}
                            className="pl-10 pr-8 py-3.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest outline-none dark:text-white appearance-none cursor-pointer"
                        >
                            <option value="">Todas as patentes</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Grid de usuários */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-64 liquid-glass rounded-[2.5rem] animate-pulse" />
                    ))}
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                    <Users size={48} className="mb-4 opacity-20" />
                    <p className="font-bold text-sm">
                        {users.length === 0 ? 'Nenhum agente recrutado ainda.' : 'Nenhum agente encontrado com os filtros aplicados.'}
                    </p>
                    {users.length === 0 && (
                        <button onClick={openCreate} className="mt-4 px-6 py-3 bg-primary text-white rounded-2xl font-bold text-xs uppercase tracking-widest">
                            Recrutar primeiro agente
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                    <AnimatePresence mode="popLayout">
                        {filteredUsers.map((user, index) => (
                            <motion.div
                                key={user.id}
                                layout
                                initial={{ opacity: 0, scale: 0.93, y: 16 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.93 }}
                                transition={{ duration: 0.35, delay: index * 0.04 }}
                                className={`liquid-glass p-8 rounded-[2.5rem] border shadow-xl group relative overflow-hidden transition-all ${user.isActive ? 'border-white/80 dark:border-white/10' : 'border-rose-200 dark:border-rose-900/30 opacity-70'}`}
                            >
                                {/* Actions overlay */}
                                <div className="absolute top-5 right-5 flex gap-2 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-200 z-10">
                                    <button
                                        onClick={() => openEdit(user)}
                                        title="Editar"
                                        className="h-9 w-9 flex items-center justify-center bg-white dark:bg-white/10 rounded-xl shadow-lg text-slate-500 hover:text-primary hover:bg-primary/10 transition-all border border-slate-100 dark:border-white/10 active:scale-90"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user)}
                                        title="Remover"
                                        disabled={deletingId === user.id}
                                        className="h-9 w-9 flex items-center justify-center bg-white dark:bg-white/10 rounded-xl shadow-lg text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-slate-100 dark:border-white/10 active:scale-90"
                                    >
                                        {deletingId === user.id ? <RefreshCcw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    </button>
                                </div>

                                {/* Avatar + Info */}
                                <div className="flex items-center gap-5 mb-7">
                                    <div className="relative shrink-0">
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={user.name} className="h-16 w-16 rounded-[1.5rem] object-cover shadow-xl" />
                                        ) : (
                                            <div className="h-16 w-16 rounded-[1.5rem] bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-primary/20 group-hover:rotate-3 transition-transform">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${user.isActive ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-black text-lg text-slate-900 dark:text-white truncate tracking-tight leading-tight">
                                            {user.name}
                                        </h3>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(user.email); toast.success('Email copiado'); }}
                                            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-primary transition-colors mt-0.5 group/email"
                                            title="Copiar email"
                                        >
                                            <Mail size={11} />
                                            <span className="truncate">{user.email}</span>
                                            <Copy size={9} className="opacity-0 group-hover/email:opacity-100 transition-opacity shrink-0" />
                                        </button>
                                    </div>
                                </div>

                                {/* Role badge */}
                                {user.role && (
                                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest mb-4 ${getRoleColor(user.role.name)}`}>
                                        <ShieldCheck size={12} />
                                        {user.role.name}
                                    </div>
                                )}

                                {/* Departments chips */}
                                {user.departments && user.departments.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 mb-5">
                                        {user.departments.map(ud => (
                                            <span
                                                key={ud.id}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider"
                                            >
                                                {ud.department.emoji && <span>{ud.department.emoji}</span>}
                                                {ud.department.name}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mb-5">
                                        <span className="text-[10px] text-slate-400 italic">Sem departamento</span>
                                    </div>
                                )}

                                {/* Footer: status toggle */}
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                        {user.isActive ? 'Operacional' : 'Inativo'}
                                    </span>
                                    <button
                                        onClick={() => handleToggleStatus(user)}
                                        disabled={togglingId === user.id}
                                        title={user.isActive ? 'Desativar agente' : 'Ativar agente'}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border active:scale-95 ${user.isActive
                                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500 hover:text-white'
                                            : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500 hover:text-white'
                                            }`}
                                    >
                                        {togglingId === user.id ? (
                                            <RefreshCcw size={12} className="animate-spin" />
                                        ) : user.isActive ? (
                                            <PowerOff size={12} />
                                        ) : (
                                            <Power size={12} />
                                        )}
                                        {user.isActive ? 'Desativar' : 'Ativar'}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Drawer de criação/edição */}
            <AnimatePresence>
                {showDrawer && (
                    <UserDrawer
                        user={editingUser}
                        roles={roles}
                        departments={departments}
                        onClose={() => setShowDrawer(false)}
                        onSave={(updated) => {
                            if (editingUser) {
                                setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
                            } else {
                                setUsers(prev => [...prev, updated]);
                            }
                            setShowDrawer(false);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Drawer de criação/edição ───────────────────────────────────────────────

interface DrawerProps {
    user: User | null;
    roles: Role[];
    departments: Department[];
    onClose: () => void;
    onSave: (user: User) => void;
}

function UserDrawer({ user, roles, departments, onClose, onSave }: DrawerProps) {
    const isNew = !user;
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [form, setForm] = useState({
        name: user?.name ?? '',
        email: user?.email ?? '',
        password: '',
        passwordConfirm: '',
        roleId: user?.roleId ?? (roles[0]?.id ?? ''),
        departmentIds: user?.departments?.map(d => d.departmentId) ?? [],
        isActive: user?.isActive ?? true,
    });

    const toggleDept = (id: string) => {
        setForm(prev => ({
            ...prev,
            departmentIds: prev.departmentIds.includes(id)
                ? prev.departmentIds.filter(d => d !== id)
                : [...prev.departmentIds, id],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isNew && !form.password) {
            toast.error('Senha é obrigatória para novos usuários');
            return;
        }
        if (form.password && form.password !== form.passwordConfirm) {
            toast.error('As senhas não coincidem');
            return;
        }
        if (form.password && form.password.length < 6) {
            toast.error('A senha deve ter pelo menos 6 caracteres');
            return;
        }

        setSubmitting(true);
        try {
            const payload: any = {
                name: form.name,
                email: form.email,
                roleId: form.roleId,
                departmentIds: form.departmentIds,
                isActive: form.isActive,
            };
            if (form.password) payload.password = form.password;

            let result: User;
            if (isNew) {
                result = await usersService.create(payload as CreateUserPayload);
                toast.success('Agente recrutado com sucesso!');
            } else {
                result = await usersService.update(user.id, payload as UpdateUserPayload);
                toast.success('Cadastro atualizado!');
            }
            onSave(result);
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Erro ao salvar usuário';
            toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-end">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
            />
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                className="relative w-full max-w-lg h-full bg-white dark:bg-slate-900 shadow-[-20px_0_80px_rgba(0,0,0,0.12)] overflow-y-auto border-l border-slate-200 dark:border-white/10 flex flex-col"
            >
                {/* Header */}
                <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-10">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter italic">
                            {isNew ? 'Recrutar' : 'Editar'} <span className="text-primary">Agente</span>
                        </h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                            {isNew ? 'Novo acesso ao sistema' : `Editando: ${user.name}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6 flex-1">
                    {/* Nome */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome completo</label>
                        <input
                            required
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold dark:text-white transition-all"
                            placeholder="Ex: João da Silva"
                        />
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                required
                                type="email"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold dark:text-white transition-all"
                                placeholder="agente@empresa.com"
                            />
                        </div>
                    </div>

                    {/* Senha */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            {isNew ? 'Senha' : 'Nova senha (deixe em branco para não alterar)'}
                        </label>
                        <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                required={isNew}
                                type={showPassword ? 'text' : 'password'}
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                minLength={6}
                                className="w-full pl-12 pr-12 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold dark:text-white transition-all"
                                placeholder="Mínimo 6 caracteres"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Confirmar senha */}
                    {(isNew || form.password) && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar senha</label>
                            <div className="relative">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    required={isNew || !!form.password}
                                    type={showConfirm ? 'text' : 'password'}
                                    value={form.passwordConfirm}
                                    onChange={e => setForm({ ...form, passwordConfirm: e.target.value })}
                                    className={`w-full pl-12 pr-12 py-3.5 rounded-2xl border bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 text-sm font-semibold dark:text-white transition-all ${form.passwordConfirm && form.password !== form.passwordConfirm
                                        ? 'border-rose-400 focus:ring-rose-300'
                                        : 'border-slate-200 dark:border-white/10 focus:ring-primary/20'
                                        }`}
                                    placeholder="Repita a senha"
                                />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                                {form.passwordConfirm && form.password === form.passwordConfirm && (
                                    <Check size={14} className="absolute right-12 top-1/2 -translate-y-1/2 text-emerald-500" />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Role */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Shield size={11} className="text-primary" /> Patente / Role
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {roles.map(r => (
                                <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => setForm({ ...form, roleId: r.id })}
                                    className={`p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all text-left ${form.roleId === r.id
                                        ? 'bg-primary border-primary text-white shadow-md'
                                        : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:border-primary/40'
                                        }`}
                                >
                                    {r.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Departamentos (multi-select) */}
                    {departments.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <Building2 size={11} className="text-primary" /> Departamentos
                                <span className="text-slate-300 normal-case font-normal">(múltiplos)</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {departments.map(d => {
                                    const selected = form.departmentIds.includes(d.id);
                                    return (
                                        <button
                                            key={d.id}
                                            type="button"
                                            onClick={() => toggleDept(d.id)}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-bold transition-all ${selected
                                                ? 'bg-primary/10 border-primary/30 text-primary'
                                                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:border-primary/20'
                                                }`}
                                        >
                                            {selected && <Check size={10} className="text-primary" />}
                                            {d.emoji && <span>{d.emoji}</span>}
                                            {d.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Status */}
                    <label className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 cursor-pointer hover:bg-primary/5 transition-all">
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={form.isActive}
                                onChange={e => setForm({ ...form, isActive: e.target.checked })}
                                className="w-5 h-5 rounded-md border-slate-300 text-primary focus:ring-0 cursor-pointer accent-primary"
                            />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest block">
                                Agente ativo no sistema
                            </span>
                            <span className="text-[9px] font-medium text-slate-400 block mt-0.5">
                                Usuários inativos não conseguem fazer login
                            </span>
                        </div>
                    </label>
                </form>

                {/* Footer */}
                <div className="p-8 pt-0 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-rose-500/5 hover:text-rose-500 active:scale-95 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit as any}
                        disabled={submitting}
                        className="flex-1 py-3.5 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {submitting ? <RefreshCcw className="animate-spin h-4 w-4" /> : (
                            <>
                                <Save size={14} />
                                {isNew ? 'Confirmar Alistamento' : 'Salvar Alterações'}
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
