'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
    User,
    Mail,
    Lock,
    Save,
    ShieldCheck,
    Building2,
    RefreshCcw,
    CheckCircle2,
    AlertCircle,
    Camera,
    Upload
} from 'lucide-react';

export default function ProfilePage() {
    const { user, updateUser } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        name: user?.name || '',
        email: user?.email || '',
        password: '',
        confirmPassword: ''
    });

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const uploadResp = await api.post('/uploads', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const { url } = uploadResp.data;

            await api.patch('/users/me/avatar', { avatarUrl: url });
            updateUser({ avatar: url });
            toast.success('Foto de perfil atualizada!');
        } catch {
            toast.error('Erro ao atualizar foto de perfil');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (form.password && form.password !== form.confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        setSubmitting(true);
        try {
            const payload: any = { name: form.name };
            if (form.password) payload.password = form.password;

            const response = await api.patch('/users/me', payload);
            updateUser(response.data);
            setSuccess(true);
            setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
            toast.success('Perfil atualizado com sucesso!');
        } catch {
            setError('Falha ao atualizar perfil. Tente novamente.');
            toast.error('Erro ao salvar perfil');
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <div className="liquid-glass aurora min-h-0 md:min-h-[calc(100vh-8rem)] p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Area */}
            <div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                    <User className="text-blue-600" size={32} /> Meu Perfil
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">Gerencie suas informações pessoais e segurança da conta</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Side: Avatar + Summary Card */}
                <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card p-8 rounded-[3rem] text-center border border-white/20 shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-blue-600/5 pointer-events-none" />
                        <div className="relative">
                            {/* Avatar Upload Area */}
                            <div className="relative mx-auto w-24 h-24 mb-6">
                                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 mx-auto flex items-center justify-center text-white text-4xl font-black shadow-2xl ring-4 ring-white dark:ring-gray-800 overflow-hidden">
                                    {user.avatar ? (
                                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{user.name.charAt(0)}</span>
                                    )}
                                </div>
                                {/* Camera Button */}
                                <button
                                    onClick={() => avatarInputRef.current?.click()}
                                    disabled={uploadingAvatar}
                                    className="absolute -bottom-1 -right-1 h-9 w-9 bg-primary text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-800 hover:scale-110 transition-transform disabled:opacity-60"
                                    title="Trocar foto de perfil"
                                >
                                    {uploadingAvatar ? (
                                        <RefreshCcw size={14} className="animate-spin" />
                                    ) : (
                                        <Camera size={14} />
                                    )}
                                </button>
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleAvatarUpload}
                                />
                            </div>

                            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{user.name}</h3>
                            <p className="text-sm font-bold text-gray-400 mt-1">{user.email}</p>

                            {/* Upload hint */}
                            <button
                                onClick={() => avatarInputRef.current?.click()}
                                className="mt-3 flex items-center gap-2 mx-auto text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                            >
                                <Upload size={10} /> Trocar foto
                            </button>

                            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-white/5 space-y-4">
                                <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-gray-400">
                                    <span>Papel</span>
                                    <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-lg">{(user as any).role?.name || 'Agente'}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-gray-400">
                                    <span>Departamento</span>
                                    <span className="text-gray-900 dark:text-white">{(user as any).department?.name || 'Geral'}</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <div className="glass-card p-6 rounded-[2rem] bg-indigo-600 text-white shadow-xl shadow-indigo-500/20">
                        <ShieldCheck className="mb-4" />
                        <p className="text-sm font-black leading-tight uppercase tracking-widest">Segurança</p>
                        <p className="text-[10px] opacity-80 mt-2 font-medium">Sua conta está protegida por criptografia e autenticação JWT de alta segurança.</p>
                    </div>
                </div>

                {/* Right Side: Edit Form */}
                <div className="md:col-span-2">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-card p-10 rounded-[3rem] border border-white/20 shadow-xl relative z-10"
                    >
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {success && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-green-100 dark:bg-green-900/30 text-green-600 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm">
                                    <CheckCircle2 size={18} /> Perfil atualizado com sucesso!
                                </motion.div>
                            )}

                            {error && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-100 dark:bg-red-900/30 text-red-600 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm">
                                    <AlertCircle size={18} /> {error}
                                </motion.div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 col-span-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                        <User size={12} /> Nome de Exibição
                                    </label>
                                    <input
                                        required
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-blue-500/50 rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all dark:text-white"
                                        placeholder="Seu nome completo"
                                    />
                                </div>

                                <div className="space-y-2 col-span-2 opacity-50 cursor-not-allowed">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                        <Mail size={12} /> E-mail (Não editável)
                                    </label>
                                    <input
                                        disabled
                                        value={form.email}
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-transparent rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all dark:text-white"
                                    />
                                </div>

                                <div className="pt-4 col-span-2">
                                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                        <Lock size={14} className="text-blue-600" /> Alterar Senha
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Nova Senha</label>
                                            <input
                                                type="password"
                                                value={form.password}
                                                onChange={e => setForm({ ...form, password: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-blue-500/50 rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all dark:text-white"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Confirmar Senha</label>
                                            <input
                                                type="password"
                                                value={form.confirmPassword}
                                                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-blue-500/50 rounded-2xl px-6 py-4 text-sm font-bold outline-none transition-all dark:text-white"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-10 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-10 rounded-2xl shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-3 group disabled:opacity-50 active:scale-95"
                                >
                                    {submitting ? <RefreshCcw className="animate-spin" size={20} /> : <Save size={20} />}
                                    <span className="tracking-widest text-xs">SALVAR MEUS DADOS</span>
                                </button>
                            </div>
                        </form>
                    </motion.div>

                    <div className="mt-8 p-6 glass-morphism rounded-[2rem] flex items-center gap-5 border border-white/10 opacity-60">
                        <div className="h-12 w-12 bg-white/10 rounded-xl flex items-center justify-center">
                            <Building2 size={24} className="text-gray-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Informação Institucional</p>
                            <p className="text-xs font-bold text-gray-500">Para alterar seu departamento ou cargo, entre em contato com o administrador do sistema.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
