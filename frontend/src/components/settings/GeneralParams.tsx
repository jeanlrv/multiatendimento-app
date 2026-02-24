'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    SlidersHorizontal, Clock, Search, MessageSquare, Users,
    Star, Bot, Link2, Database, ShieldCheck, Download,
    Bell, ArrowRightLeft, BarChart3, Save, RefreshCcw, History
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '@/services/api';

// ============================================
// Chaves padrão dos Parâmetros
// ============================================
const DEFAULT_PARAMS: Record<string, any> = {
    ticketExpirationMinutes: 30,
    searchBarDefault: 'in_progress',
    expiredTicketMessage: 'Seu atendimento foi encerrado por inatividade. Caso precise de ajuda, envie uma nova mensagem.',
    ticketExpirationNotApplyGroups: true,
    evaluationExpirationMinutes: 5,
    evaluationScale: 5,
    botExpirationMinutes: 10,
    ticketsByConnection: false,
    historyByConnection: false,
    historyByConnectionAdmin: true,
    canDeleteTickets: false,
    canDeleteMessages: false,
    forceDownload: false,
    showDownloadConfirmation: true,
    userOnlyDefaultConnection: false,
    showLinksToUsers: true,
    enableBotNotifications: false,
    autoDistribution: true,
    autoDistributionBySector: false,
    enableGroupNotifications: false,
    ignoreUserConnectionForGroups: false,
    startGroupTicketWaiting: true,
    transferGroupTicketBetweenUsers: false,
    enableGroupTicketHistory: false,
    enableTicketQualification: true,
    enableTicketMetrics: true,
};

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

function NumberInput({ value, onChange, min = 0, suffix = '', placeholder = '0' }: { value: number; onChange: (val: number) => void; min?: number; suffix?: string; placeholder?: string }) {
    return (
        <div className="flex items-center gap-2">
            <input
                type="number"
                value={value}
                min={min}
                onChange={(e) => onChange(Math.max(min, parseInt(e.target.value) || min))}
                className="w-24 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all text-center font-black italic text-slate-700 dark:text-white"
                placeholder={placeholder}
            />
            {suffix && <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{suffix}</span>}
        </div>
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

function ParamSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 px-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                {title}
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            </h4>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

// ============================================
// Componente Principal
// ============================================
export function GeneralParams() {
    const [params, setParams] = useState<Record<string, any>>({ ...DEFAULT_PARAMS });
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        const fetchParams = async () => {
            try {
                const response = await api.get('/settings');
                if (response.data && typeof response.data === 'object') {
                    setParams((prev) => ({ ...prev, ...response.data }));
                }
            } catch {
                toast.error('Erro ao carregar parâmetros do sistema.');
            }
        };
        fetchParams();
    }, []);

    const updateParam = useCallback((key: string, value: any) => {
        setParams((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleSaveParams = async () => {
        setSaving(true);
        setSaveSuccess(false);
        try {
            await api.put('/settings', params);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Erro ao salvar parâmetros:', error);
            toast.error('Erro ao salvar parâmetros do sistema.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-2xl">
                    <SlidersHorizontal size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Parâmetros do Sistema</h3>
                    <p className="text-sm text-gray-500">Configure o comportamento da plataforma para sua empresa.</p>
                </div>
            </div>

            {/* Atendimento */}
            <ParamSection title="Atendimento">
                <ParamRow icon={Clock} label="Tempo de expiração do atendimento" description="Minutos de inatividade antes de encerrar automaticamente.">
                    <NumberInput value={params.ticketExpirationMinutes} onChange={(v) => updateParam('ticketExpirationMinutes', v)} min={1} suffix="min" />
                </ParamRow>
                <ParamRow icon={Search} label="Barra de busca 'em atendimento' por padrão" description="Define o filtro padrão da barra de busca nos tickets.">
                    <ToggleSwitch enabled={params.searchBarDefault === 'in_progress'} onChange={(v) => updateParam('searchBarDefault', v ? 'in_progress' : 'all')} />
                </ParamRow>
                <div className="space-y-2 p-6 bg-slate-50 dark:bg-white/5 rounded-[1.5rem] border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-100 dark:border-white/5">
                            <MessageSquare size={16} className="text-primary" />
                        </div>
                        <div>
                            <span className="text-sm font-black text-slate-800 dark:text-gray-200 italic">Mensagem de expiração</span>
                            <span className="text-[10px] text-slate-400 block font-black uppercase tracking-widest">Enviada ao encerrar por inatividade.</span>
                        </div>
                    </div>
                    <textarea
                        value={params.expiredTicketMessage}
                        onChange={(e) => updateParam('expiredTicketMessage', e.target.value)}
                        rows={3}
                        className="w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none italic font-black text-slate-600 dark:text-slate-300"
                    />
                </div>
                <ParamRow icon={Users} label="Não se aplica a atendimentos de grupos" description="A expiração automática não afeta grupos.">
                    <ToggleSwitch enabled={params.ticketExpirationNotApplyGroups} onChange={(v) => updateParam('ticketExpirationNotApplyGroups', v)} />
                </ParamRow>
            </ParamSection>

            {/* Avaliação */}
            <ParamSection title="Avaliação">
                <ParamRow icon={Clock} label="Tempo de expiração da avaliação" description="Minutos aguardando o usuário avaliar (mínimo 1).">
                    <NumberInput value={params.evaluationExpirationMinutes} onChange={(v) => updateParam('evaluationExpirationMinutes', v)} min={1} suffix="min" />
                </ParamRow>
                <ParamRow icon={Star} label="Escala de avaliação" description="Nota máxima na escala de avaliação (ex: 5 ou 10).">
                    <NumberInput value={params.evaluationScale} onChange={(v) => updateParam('evaluationScale', v)} min={1} suffix="estrelas" />
                </ParamRow>
            </ParamSection>

            {/* Admin */}
            <ParamSection title="Operacional & Admin">
                <ParamRow icon={Link2} label="Atendimentos por conexão" description="Separar visualização de tickets por conexão WhatsApp.">
                    <ToggleSwitch enabled={params.ticketsByConnection} onChange={(v) => updateParam('ticketsByConnection', v)} />
                </ParamRow>
                <ParamRow icon={Database} label="Histórico por conexão" description="Filtrar histórico de mensagens por conexão.">
                    <ToggleSwitch enabled={params.historyByConnection} onChange={(v) => updateParam('historyByConnection', v)} />
                </ParamRow>
                <ParamRow icon={ShieldCheck} label="Histórico de conexão para administrador" description="Administradores podem ver histórico de todas as conexões.">
                    <ToggleSwitch enabled={params.historyByConnectionAdmin} onChange={(v) => updateParam('historyByConnectionAdmin', v)} />
                </ParamRow>
                <ParamRow icon={MessageSquare} label="Pode excluir atendimentos" description="Permitir exclusão permanente de tickets.">
                    <ToggleSwitch enabled={params.canDeleteTickets} onChange={(v) => updateParam('canDeleteTickets', v)} />
                </ParamRow>
                <ParamRow icon={MessageSquare} label="Pode excluir mensagens" description="Permitir exclusão de mensagens individuais.">
                    <ToggleSwitch enabled={params.canDeleteMessages} onChange={(v) => updateParam('canDeleteMessages', v)} />
                </ParamRow>
                <ParamRow icon={Download} label="Forçar download ao clicar no link" description="Arquivos são baixados automaticamente ao clicar.">
                    <ToggleSwitch enabled={params.forceDownload} onChange={(v) => updateParam('forceDownload', v)} />
                </ParamRow>
                <ParamRow icon={Download} label="Mostrar tela de confirmação para download" description="Exibir modal antes de iniciar o download.">
                    <ToggleSwitch enabled={params.showDownloadConfirmation} onChange={(v) => updateParam('showDownloadConfirmation', v)} />
                </ParamRow>
                <ParamRow icon={Users} label="Usuário vê apenas sua conexão padrão" description="Restringe a visualização de tickets à conexão padrão do agente.">
                    <ToggleSwitch enabled={params.userOnlyDefaultConnection} onChange={(v) => updateParam('userOnlyDefaultConnection', v)} />
                </ParamRow>
                <ParamRow icon={Link2} label="Mostrar links para os usuários" description="Exibir links clicáveis nas conversas.">
                    <ToggleSwitch enabled={params.showLinksToUsers} onChange={(v) => updateParam('showLinksToUsers', v)} />
                </ParamRow>
                <ParamRow icon={Bell} label="Habilitar notificações para Bots" description="Bots também disparam notificações sonoras e visuais.">
                    <ToggleSwitch enabled={params.enableBotNotifications} onChange={(v) => updateParam('enableBotNotifications', v)} />
                </ParamRow>
            </ParamSection>

            {/* Distribuição */}
            <ParamSection title="Distribuição Automática">
                <ParamRow icon={ArrowRightLeft} label="Distribuição automática" description="Novos tickets são atribuídos automaticamente ao atendente com menor carga.">
                    <ToggleSwitch enabled={params.autoDistribution} onChange={(v) => updateParam('autoDistribution', v)} />
                </ParamRow>
                <ParamRow icon={ArrowRightLeft} label="Distribuição automática por setores" description="A distribuição respeita a separação por departamentos.">
                    <ToggleSwitch enabled={params.autoDistributionBySector} onChange={(v) => updateParam('autoDistributionBySector', v)} />
                </ParamRow>
            </ParamSection>

            {/* Grupos */}
            <ParamSection title="Grupos WhatsApp">
                <ParamRow icon={Bot} label="Tempo de expiração do bot em grupos" description="Minutos de inatividade antes de encerrar bot em grupos (mínimo 1).">
                    <NumberInput value={params.botExpirationMinutes} onChange={(v) => updateParam('botExpirationMinutes', v)} min={1} suffix="min" />
                </ParamRow>
                <ParamRow icon={Bell} label="Notificações de grupos" description="Habilitar notificações sonoras e visuais para mensagens de grupos.">
                    <ToggleSwitch enabled={params.enableGroupNotifications} onChange={(v) => updateParam('enableGroupNotifications', v)} />
                </ParamRow>
                <ParamRow icon={Users} label="Ignorar conexão do usuário em grupos" description="Grupos não respeitam a conexão padrão do agente.">
                    <ToggleSwitch enabled={params.ignoreUserConnectionForGroups} onChange={(v) => updateParam('ignoreUserConnectionForGroups', v)} />
                </ParamRow>
                <ParamRow icon={MessageSquare} label="Iniciar ticket de grupo em espera" description="Novos tickets de grupos entram com status 'Aguardando' em vez de 'Em atendimento'.">
                    <ToggleSwitch enabled={params.startGroupTicketWaiting} onChange={(v) => updateParam('startGroupTicketWaiting', v)} />
                </ParamRow>
                <ParamRow icon={ArrowRightLeft} label="Transferir ticket de grupo entre usuários" description="Permitir transferência de tickets de grupo entre agentes.">
                    <ToggleSwitch enabled={params.transferGroupTicketBetweenUsers} onChange={(v) => updateParam('transferGroupTicketBetweenUsers', v)} />
                </ParamRow>
                <ParamRow icon={History} label="Histórico de tickets de grupo" description="Exibir histórico de mensagens anteriores em tickets de grupo.">
                    <ToggleSwitch enabled={params.enableGroupTicketHistory} onChange={(v) => updateParam('enableGroupTicketHistory', v)} />
                </ParamRow>
            </ParamSection>

            {/* Qualificação */}
            <ParamSection title="Qualificação & Métricas">
                <ParamRow icon={Star} label="Habilitar qualificação de atendimentos" description="Solicitar avaliação do cliente ao final do atendimento.">
                    <ToggleSwitch enabled={params.enableTicketQualification} onChange={(v) => updateParam('enableTicketQualification', v)} />
                </ParamRow>
                <ParamRow icon={BarChart3} label="Métricas de Tickets" description="Exibir métricas detalhadas no dashboard (tempo médio, SLA, etc).">
                    <ToggleSwitch enabled={params.enableTicketMetrics} onChange={(v) => updateParam('enableTicketMetrics', v)} />
                </ParamRow>
            </ParamSection>

            {/* Botão Salvar */}
            <div className="flex items-center justify-end gap-6 pt-10 border-t border-slate-100 dark:border-white/5">
                {saveSuccess && (
                    <motion.span
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-[11px] font-black text-primary uppercase tracking-widest italic flex items-center gap-2"
                    >
                        <ShieldCheck size={16} /> Parâmetros Sincronizados
                    </motion.span>
                )}
                <button
                    onClick={handleSaveParams}
                    disabled={saving}
                    className="flex items-center gap-4 bg-slate-900 dark:bg-primary text-white px-10 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] transition-all shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 group"
                >
                    {saving ? <RefreshCcw className="animate-spin h-6 w-6" /> : <Save size={24} className="group-hover:translate-x-1 transition-transform" />}
                    ATUALIZAR MATRIZ KSZAP
                </button>
            </div>
        </div>
    );
}

