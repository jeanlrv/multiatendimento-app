'use client';

import { useState, useEffect } from 'react';
import { Zap, Settings, Trash2, Save, RefreshCcw, Sparkles, Bot, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface Integration {
    id: string;
    name: string;
    provider: string;
    zapiInstanceId: string;
    zapiToken: string;
    zapiClientToken?: string;
    isActive: boolean;
}

interface FormData {
    name: string;
    provider: string;
    zapiInstanceId: string;
    zapiToken: string;
    zapiClientToken: string;
    isActive: boolean;
}

const emptyForm: FormData = {
    name: '',
    provider: 'ZAPI',
    zapiInstanceId: '',
    zapiToken: '',
    zapiClientToken: '',
    isActive: true,
};

export function IntegrationsManager() {
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Integration | null>(null);
    const [formData, setFormData] = useState<FormData>(emptyForm);
    const [showToken, setShowToken] = useState(false);
    const [showClientToken, setShowClientToken] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    const [saving, setSaving] = useState(false);

    const fetchIntegrations = async () => {
        try {
            const response = await api.get('/settings/integrations');
            setIntegrations(response.data);
        } catch {
            toast.error('Erro ao carregar integrações');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIntegrations();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const payload: any = {
            name: formData.name,
            provider: formData.provider,
            zapiInstanceId: formData.zapiInstanceId,
            zapiToken: formData.zapiToken,
            isActive: formData.isActive,
        };
        if (formData.zapiClientToken) {
            payload.zapiClientToken = formData.zapiClientToken;
        }

        try {
            if (editing) {
                await api.patch(`/settings/integrations/${editing.id}`, payload);
                toast.success('Integração atualizada com sucesso!');
            } else {
                await api.post('/settings/integrations', payload);
                toast.success('Integração criada com sucesso!');
            }
            setEditing(null);
            setFormData(emptyForm);
            fetchIntegrations();
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Erro ao salvar integração.';
            toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (integration: Integration) => {
        setEditing(integration);
        setFormData({
            name: integration.name,
            provider: integration.provider,
            zapiInstanceId: integration.zapiInstanceId || '',
            zapiToken: integration.zapiToken || '',
            zapiClientToken: integration.zapiClientToken || '',
            isActive: integration.isActive,
        });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Deseja excluir esta integração?')) return;
        try {
            await api.delete(`/settings/integrations/${id}`);
            toast.success('Integração removida');
            fetchIntegrations();
        } catch {
            toast.error('Erro ao excluir integração');
        }
    };

    const handleSeedMasterFlow = async () => {
        setIsSeeding(true);
        try {
            await api.post('/workflows/seed-default', {});
            toast.success('Aero Master Flow ativado com sucesso!');
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Falha ao ativar o Fluxo Mestre.';
            toast.error(msg);
        } finally {
            setIsSeeding(false);
        }
    };

    const handleCancel = () => {
        setEditing(null);
        setFormData(emptyForm);
    };

    if (loading) return (
        <div className="text-center p-10 font-black animate-pulse text-primary tracking-widest uppercase text-xs">
            Carregando Integrações...
        </div>
    );

    return (
        <div className="space-y-12">
            {/* Aero Master Flow */}
            <div className="p-8 liquid-glass bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/30 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 transform -rotate-12 group-hover:rotate-0 transition-all duration-700">
                    <Sparkles size={120} className="text-primary" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="h-24 w-24 bg-primary text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-primary/40 flex-shrink-0">
                        <Bot size={48} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter italic mb-2">
                            Aero Master Flow <span className="text-primary">V1</span>
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-bold max-w-xl leading-relaxed">
                            Ative a inteligência total do ecossistema Aero. Triagem automática por IA, classificação de urgência,
                            roteamento por departamento e controle de SLA em um só clique.
                        </p>
                    </div>
                    <button
                        onClick={handleSeedMasterFlow}
                        disabled={isSeeding}
                        className="bg-primary hover:bg-primary/90 text-white font-black py-5 px-10 rounded-[2rem] shadow-2xl shadow-primary/30 transition-all flex items-center gap-3 active:scale-95 text-[10px] tracking-[0.2em] whitespace-nowrap disabled:opacity-50"
                    >
                        {isSeeding ? <RefreshCcw className="animate-spin h-4 w-4" /> : <Zap className="h-4 w-4" />}
                        {isSeeding ? 'ATIVANDO...' : 'ATIVAR FLUXO MESTRE'}
                    </button>
                </div>
            </div>

            {/* Cabeçalho */}
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl">
                    <Zap size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Integrações Z-API</h3>
                    <p className="text-sm text-gray-500">
                        Configure as credenciais globais. As conexões WhatsApp as usarão automaticamente.
                    </p>
                </div>
            </div>

            {/* Lista de integrações */}
            {integrations.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {integrations.map((item) => (
                        <div key={item.id} className="p-6 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-3xl hover:shadow-xl transition-all group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-primary text-white rounded-xl flex items-center justify-center font-black shadow-lg shadow-primary/20 text-sm">
                                        {item.provider.substring(0, 1)}
                                    </div>
                                    <div>
                                        <h4 className="font-black italic text-slate-800 dark:text-white tracking-tight">{item.name}</h4>
                                        <p className="text-[10px] uppercase font-black tracking-widest">
                                            <span className={item.isActive ? 'text-emerald-500' : 'text-slate-400'}>
                                                {item.provider} • {item.isActive ? '● Ativo' : '○ Inativo'}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(item)}
                                        className="p-2 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all"
                                        title="Editar"
                                    >
                                        <Settings size={16} className="text-slate-400 group-hover:text-primary" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                        title="Excluir"
                                    >
                                        <Trash2 size={16} className="text-slate-400 hover:text-red-500" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1 text-[10px] font-mono text-slate-400">
                                <p>Instance ID: <span className="font-black">{item.zapiInstanceId}</span></p>
                                <p>Token: <span className="font-black">{item.zapiToken?.substring(0, 6)}••••••</span></p>
                                {item.zapiClientToken && (
                                    <p>Client-Token: <span className="font-black text-emerald-500">✓ Configurado</span></p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Formulário */}
            <div className="p-10 bg-slate-50 dark:bg-white/5 border border-primary/20 rounded-[3rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 transform rotate-12">
                    <Zap size={80} className="text-primary" />
                </div>

                <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2 italic tracking-tighter">
                    {editing ? 'Editar Integração' : 'Nova Integração Z-API'}
                </h4>
                <p className="text-xs text-slate-500 mb-8">
                    Obtenha o Instance ID e Token no painel da{' '}
                    <a href="https://developer.z-api.io" target="_blank" rel="noreferrer" className="text-primary underline font-bold">
                        Z-API
                    </a>.
                    O Client-Token é opcional — configure em Security no painel Z-API.
                </p>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    {/* Nome */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                            Nome da Integração
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-primary/10 outline-none dark:text-white font-bold"
                            placeholder="Ex: Z-API Principal"
                            required
                        />
                    </div>

                    {/* Plataforma */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                            Plataforma
                        </label>
                        <select
                            value={formData.provider}
                            onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                            className="w-full bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-primary/10 outline-none dark:text-white font-bold"
                        >
                            <option value="ZAPI">Z-API (WhatsApp)</option>
                        </select>
                    </div>

                    {/* Instance ID */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                            Instance ID
                        </label>
                        <input
                            type="text"
                            value={formData.zapiInstanceId}
                            onChange={(e) => setFormData({ ...formData, zapiInstanceId: e.target.value })}
                            className="w-full bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-primary/10 outline-none dark:text-white font-mono font-bold"
                            placeholder="3B24BCDC..."
                            required
                        />
                    </div>

                    {/* Token */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                            Token Secreto
                        </label>
                        <div className="relative">
                            <input
                                type={showToken ? 'text' : 'password'}
                                value={formData.zapiToken}
                                onChange={(e) => setFormData({ ...formData, zapiToken: e.target.value })}
                                className="w-full bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 pr-14 focus:ring-4 focus:ring-primary/10 outline-none dark:text-white font-mono font-bold"
                                placeholder="••••••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowToken(!showToken)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Client-Token (Security Token) */}
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                            Client-Token <span className="text-slate-300 normal-case font-normal">(opcional — Security Token da Z-API)</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showClientToken ? 'text' : 'password'}
                                value={formData.zapiClientToken}
                                onChange={(e) => setFormData({ ...formData, zapiClientToken: e.target.value })}
                                className="w-full bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 pr-14 focus:ring-4 focus:ring-primary/10 outline-none dark:text-white font-mono font-bold"
                                placeholder="Configure em Security no painel Z-API (opcional)"
                            />
                            <button
                                type="button"
                                onClick={() => setShowClientToken(!showClientToken)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showClientToken ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 ml-1">
                            Quando ativado no painel Z-API, todas as requisições enviadas para a Z-API incluirão este token no header <code className="bg-slate-100 dark:bg-white/10 px-1 rounded">Client-Token</code>.
                        </p>
                    </div>

                    {/* Ativo */}
                    <div className="flex items-center gap-3 md:col-span-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="h-4 w-4 rounded accent-primary"
                        />
                        <label htmlFor="isActive" className="text-sm font-bold text-slate-600 dark:text-slate-400">
                            Integração ativa
                        </label>
                    </div>

                    {/* Botões */}
                    <div className="flex items-center gap-4 md:col-span-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-primary hover:bg-primary/90 text-white font-black py-5 px-12 rounded-[2rem] shadow-2xl shadow-primary/30 transition-all flex items-center justify-center gap-3 active:scale-95 text-[10px] tracking-[0.3em] disabled:opacity-50"
                        >
                            {saving ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />}
                            {editing ? 'ATUALIZAR INTEGRAÇÃO' : 'SALVAR INTEGRAÇÃO'}
                        </button>
                        {editing && (
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-all"
                            >
                                CANCELAR
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
