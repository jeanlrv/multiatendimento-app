'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, X, Building2, Save, Activity, RefreshCcw, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface Company {
    id: string;
    name: string;
    primaryColor: string;
    secondaryColor: string;
    limitTokens: number;
}

export function CompanyManager() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            const res = await api.get('/companies');
            setCompanies(res.data);
        } catch (err: any) {
            if (err.response?.status === 403) {
                toast.error("Acesso negado. Apenas administradores podem gerenciar unidades operacionais.");
            } else {
                const msg = err.response?.data?.message || "Erro ao carregar unidades operacionais";
                toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const payload = {
            ...formData,
            limitTokens: formData.limitTokens ? Number(formData.limitTokens) : undefined,
        };
        try {
            if (editingCompany) {
                await api.patch(`/companies/${editingCompany.id}`, payload);
                toast.success("Unidade Operacional atualizada!");
            } else {
                await api.post('/companies', payload);
                toast.success("Unidade Operacional criada!");
            }
            setIsFormOpen(false);
            setEditingCompany(null);
            fetchCompanies();
        } catch (err: any) {
            const msg = err.response?.data?.message || "Erro ao salvar Unidade Operacional";
            toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('ATENÇÃO: Excluir uma unidade operacional DELETARÁ TODOS OS DADOS VINCULADOS (Usuários, tickets, conexões). Deseja prosseguir de forma irreversível?')) return;

        try {
            await api.delete(`/companies/${id}`);
            toast.success("Unidade Operacional removida!");
            fetchCompanies();
        } catch (err: any) {
            const msg = err.response?.data?.message || "Erro ao excluir. Pode haver dependências ativas.";
            toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
        }
    };

    const openForm = (company?: Company) => {
        if (company) {
            setEditingCompany(company);
            setFormData(company);
        } else {
            setEditingCompany(null);
            setFormData({ name: '', primaryColor: '#3B82F6', secondaryColor: '#1E293B', limitTokens: 100000 });
        }
        setIsFormOpen(true);
    };

    if (loading) return <div className="flex justify-center py-20"><RefreshCcw className="animate-spin text-primary" /></div>;

    if (isFormOpen) {
        return (
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="w-full relative"
            >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/10 pb-6">
                    <div className="flex items-center gap-4">
                        <div
                            className="h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center text-3xl md:text-4xl shadow-lg shadow-primary/10 transition-colors text-white"
                            style={{ backgroundColor: formData.primaryColor || '#3B82F6' }}
                        >
                            <Building2 className="h-6 w-6 md:h-8 md:w-8" />
                        </div>
                        <div>
                            <button
                                type="button"
                                onClick={() => setIsFormOpen(false)}
                                className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-xs font-black uppercase tracking-widest mb-1"
                            >
                                <ChevronLeft size={16} /> Voltar para Opções
                            </button>
                            <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-tight">
                                {editingCompany ? 'Editar' : 'Nova'} <span className="text-primary italic">Unidade</span>
                            </h3>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block ml-2">Razão / Nome Fantasia</label>
                        <input
                            required
                            value={formData.name || ''}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold dark:text-white placeholder:text-slate-400 transition-all uppercase"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block ml-2">Cor Primária</label>
                            <div className="flex gap-3 items-center">
                                <input
                                    type="color"
                                    value={formData.primaryColor || '#3B82F6'}
                                    onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                                    className="w-12 h-12 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer overflow-hidden p-0"
                                />
                                <span className="text-xs font-mono text-slate-500 uppercase font-black">{formData.primaryColor || '#3B82F6'}</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block ml-2">Cor Secundária</label>
                            <div className="flex gap-3 items-center">
                                <input
                                    type="color"
                                    value={formData.secondaryColor || '#1E293B'}
                                    onChange={e => setFormData({ ...formData, secondaryColor: e.target.value })}
                                    className="w-12 h-12 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer overflow-hidden p-0"
                                />
                                <span className="text-xs font-mono text-slate-500 uppercase font-black">{formData.secondaryColor || '#1E293B'}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block ml-2">Limite Mensal de Tokens (IA)</label>
                        <input
                            type="number"
                            value={formData.limitTokens || ''}
                            onChange={e => setFormData({ ...formData, limitTokens: e.target.value })}
                            className="w-full px-5 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold dark:text-white placeholder:text-slate-400 transition-all font-mono"
                        />
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button
                            type="button"
                            onClick={() => setIsFormOpen(false)}
                            className="flex-1 py-4 rounded-xl border border-slate-200 dark:border-white/10 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-500 shadow-sm"
                        >
                            Descartar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 py-4 rounded-xl bg-primary text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                            {submitting ? <RefreshCcw className="animate-spin" size={18} /> : (
                                <>
                                    <Save size={18} /> SALVAR UNIDADE
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-wider italic flex items-center gap-3">
                        <Building2 className="text-primary" /> Unidades Operacionais
                    </h2>
                    <p className="text-xs text-slate-500 mt-2">Gerencie as Empresas/Tenants encapsuladas na plataforma</p>
                </div>
                <button
                    onClick={() => openForm()}
                    className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg active:scale-95"
                >
                    <Plus size={16} /> Nova Unidade
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {companies.map(company => (
                    <motion.div
                        key={company.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative overflow-hidden group shadow-sm"
                    >
                        <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: company.primaryColor }} />
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-white uppercase tracking-wider ml-4">{company.name}</h3>
                            <div className="flex gap-2 relative z-10">
                                <button onClick={() => openForm(company)} className="p-2 text-slate-400 hover:text-primary transition-colors bg-white dark:bg-black/20 rounded-lg shadow-sm border border-slate-100 dark:border-white/5">
                                    <Pencil size={14} />
                                </button>
                                <button onClick={() => handleDelete(company.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors bg-white dark:bg-black/20 rounded-lg shadow-sm border border-slate-100 dark:border-white/5">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2 ml-4 mb-4">
                            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold border-b border-white/5 pb-2">
                                <span>Tokens de IA Mensais:</span>
                                <span className="text-primary font-bold">{company.limitTokens?.toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold pt-1">
                                <span>ID:</span>
                                <span className="font-mono text-[9px] opacity-70 p-1 bg-slate-100 dark:bg-white/5 rounded-md">{company.id}</span>
                            </div>
                        </div>
                        {/* Background flare based on primary color */}
                        <div
                            className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full opacity-10 blur-2xl pointer-events-none"
                            style={{ backgroundColor: company.primaryColor }}
                        />
                    </motion.div>
                ))}
            </div>

        </div>
    );
}
