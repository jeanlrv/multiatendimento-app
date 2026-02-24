'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Database, AlertTriangle, RefreshCcw, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';

// ============================================
// Sub-componentes Utilitários
// ============================================
function ToggleSwitch({ enabled, onChange, disabled = false }: { enabled: boolean; onChange: (val: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={() => !disabled && onChange(!enabled)}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-500 focus:outline-none focus:ring-4 focus:ring-primary/20 ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:shadow-[0_0_15px_rgba(56,189,248,0.3)]'} ${enabled ? 'bg-primary' : 'bg-slate-200 dark:bg-white/10'}`}
        >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-xl transition-transform duration-500 ease-in-out ${enabled ? 'translate-x-7 scale-110 shadow-primary/20' : 'translate-x-1'}`} />
        </button>
    );
}

function ParamRow({ icon: Icon, label, description, children }: { icon: any; label: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-white/5 rounded-[1.5rem] border border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/10 transition-all hover:shadow-xl group">
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-slate-100 dark:border-white/5 group-hover:scale-110 group-hover:rotate-6 transition-all">
                    <Icon size={20} className="text-primary" />
                </div>
                <div className="min-w-0">
                    <span className="text-sm font-black text-slate-800 dark:text-white block tracking-tight italic">{label}</span>
                    {description && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1 leading-tight font-black uppercase tracking-widest opacity-70">{description}</span>
                    )}
                </div>
            </div>
            <div className="flex-shrink-0 ml-6">{children}</div>
        </div>
    );
}

export function SystemSettings() {
    const [params, setParams] = useState({
        autoBackup: true,
        maintenanceMode: false,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await api.get('/settings');
                if (response.data && typeof response.data === 'object') {
                    setParams(prev => ({
                        autoBackup: response.data.autoBackup ?? prev.autoBackup,
                        maintenanceMode: response.data.maintenanceMode ?? prev.maintenanceMode,
                    }));
                }
            } catch (error) {
                console.error('Erro ao carregar configurações do sistema:', error);
                toast.error('Erro ao carregar configurações do sistema');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSaveSystemToggle = async (key: string, value: any) => {
        try {
            await api.put('/settings', { [key]: value });
            setParams(prev => ({ ...prev, [key]: value }));
            toast.success('Configuração salva com sucesso!');
        } catch (error) {
            console.error(`Erro ao salvar ${key}:`, error);
            toast.error(`Erro ao salvar configuração de ${key}`);
        }
    };

    if (loading) return (
        <div className="text-center p-10 font-black animate-pulse text-primary tracking-widest uppercase text-xs">
            Carregando Configurações do Sistema...
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-6 mb-12">
                <div className="p-5 bg-primary/10 text-primary rounded-[1.5rem] border border-primary/20 shadow-inner">
                    <Settings size={32} />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter italic">Controle de Sistema</h3>
                    <p className="text-[10px] font-black text-slate-400 shadow-inner uppercase tracking-[0.2em] mt-1 italic">Gestão de infraestrutura e segurança tática</p>
                </div>
            </div>

            <div className="p-8 border border-yellow-100 dark:border-yellow-900/30 rounded-[2rem] bg-yellow-50 dark:bg-yellow-900/10 flex gap-6 shadow-inner">
                <ShieldCheck className="text-yellow-600 flex-shrink-0" size={24} />
                <div>
                    <h4 className="font-black italic text-yellow-800 dark:text-yellow-200">Segurança do Sistema</h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-yellow-700 dark:text-yellow-400 opacity-70 leading-relaxed">
                        Configurações globais de acesso e auditoria. Apenas administradores do sistema podem modificar estes parâmetros para garantir a integridade da matriz.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ParamRow icon={Database} label="Backup Automático" description="Realizar backup diário do banco de dados na nuvem.">
                    <ToggleSwitch
                        enabled={params.autoBackup}
                        onChange={(v) => handleSaveSystemToggle('autoBackup', v)}
                    />
                </ParamRow>
                <ParamRow icon={AlertTriangle} label="Modo de Manutenção" description="Bloqueia o acesso de usuários comuns para manutenção tática.">
                    <ToggleSwitch
                        enabled={params.maintenanceMode}
                        onChange={(v) => handleSaveSystemToggle('maintenanceMode', v)}
                    />
                </ParamRow>
            </div>
        </div>
    );
}
