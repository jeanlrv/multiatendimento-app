'use client';

import { useState, useEffect } from 'react';
import { Mail, RefreshCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

export function SmtpSettings() {
    const [fetching, setFetching] = useState(true);
    const [saving, setSaving] = useState(false);
    const [smtp, setSmtp] = useState({
        host: '',
        port: 587,
        user: '',
        password: '',
        fromEmail: '',
        fromName: '',
    });

    useEffect(() => {
        const fetchSmtp = async () => {
            try {
                const response = await api.get('/settings/smtp');
                if (response.data) setSmtp(response.data);
            } catch {
                toast.error('Erro ao carregar configuração de e-mail.');
            } finally {
                setFetching(false);
            }
        };
        fetchSmtp();
    }, []);

    const handleSaveSmtp = async () => {
        setSaving(true);
        try {
            await api.patch('/settings/smtp', smtp);
            toast.success('Configuração de e-mail salva com sucesso!');
        } catch {
            toast.error('Erro ao salvar configuração de e-mail.');
        } finally {
            setSaving(false);
        }
    };

    if (fetching) return (
        <div className="text-center p-10 font-black animate-pulse text-primary tracking-widest uppercase text-xs">
            Carregando Configuração de E-mail...
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-6 mb-12">
                <div className="p-5 bg-primary/10 text-primary rounded-[1.5rem] border border-primary/20 shadow-inner">
                    <Mail size={32} />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter italic">Canais de Alerta</h3>
                    <p className="text-[10px] font-black text-slate-400 shadow-inner uppercase tracking-[0.2em] mt-1 italic">Setup do servidor de correio tático</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">SMTP Host</label>
                    <input
                        type="text"
                        value={smtp.host}
                        onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white italic font-black"
                        placeholder="smtp.exemplo.com"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Porta SMTP</label>
                    <input
                        type="number"
                        value={smtp.port}
                        onChange={(e) => setSmtp({ ...smtp, port: parseInt(e.target.value) || 587 })}
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white font-mono"
                        placeholder="587"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Usuário</label>
                    <input
                        type="text"
                        value={smtp.user}
                        onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Senha</label>
                    <input
                        type="password"
                        value={smtp.password}
                        onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">E-mail de Envio</label>
                    <input
                        type="email"
                        value={smtp.fromEmail}
                        onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                        placeholder="noreply@kszap.com"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Nome de Exibição</label>
                    <input
                        type="text"
                        value={smtp.fromName}
                        onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white"
                        placeholder="KSZap Alertas"
                    />
                </div>
            </div>

            <div className="flex justify-end pt-6">
                <button
                    onClick={handleSaveSmtp}
                    disabled={saving}
                    className="flex items-center gap-4 bg-primary hover:bg-primary/90 text-white px-10 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] transition-all shadow-[0_15px_40px_rgba(56,189,248,0.3)] disabled:opacity-50 active:scale-95 group"
                >
                    {saving ? <RefreshCcw className="animate-spin h-5 w-5" /> : <Save size={20} className="group-hover:rotate-12 transition-transform" />}
                    ATUALIZAR MÓDULO E-MAIL
                </button>
            </div>
        </div>
    );
}
