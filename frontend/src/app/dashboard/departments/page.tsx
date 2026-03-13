'use client';

import { useState, useEffect } from 'react';
import { DepartmentsService, Department } from '@/services/departments';
import { WorkflowsService, WorkflowRule } from '@/services/workflows';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    Building,
    Bot,
    Clock,
    Save,
    LayoutDashboard,
    RefreshCcw,
    Activity,
    Shield,
    Palette,
    Zap,
    ChevronLeft,
    AlertCircle,
    Share2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AIAgentsService, AIAgent } from '@/services/ai-agents';
import { toast } from 'sonner';

const departmentSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    description: z.string().optional(),
    emoji: z.string().default('💬'),
    color: z.string().default('#2563eb'),
    slaFirstResponseMin: z
        .number({ invalid_type_error: 'Informe um número válido' })
        .min(1, 'SLA deve ser ao menos 1 minuto')
        .default(60),
    slaResolutionMin: z
        .number({ invalid_type_error: 'Informe um número válido' })
        .min(1, 'SLA deve ser ao menos 1 minuto')
        .default(1440),
    outOfHoursMessage: z.string().optional(),
    greetingMessage: z.string().optional(),
    timezone: z.string().default('America/Sao_Paulo'),
    aiAgentId: z.string().optional().nullable(),
    workflowId: z.string().optional().nullable(),
    defaultMode: z.enum(['AI', 'HUMANO', 'HIBRIDO']).default('AI'),
    autoDistribute: z.boolean().default(true),
    isActive: z.boolean().default(true),
    businessHours: z.any().optional(),
});

type DepartmentForm = z.infer<typeof departmentSchema>;

const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
];

const DEFAULT_HOURS = DAYS_OF_WEEK.reduce((acc, day) => ({
    ...acc,
    [day.key]: { active: !['saturday', 'sunday'].includes(day.key), start: '08:00', end: '18:00' },
}), {} as Record<string, { active: boolean; start: string; end: string }>);

/** Converte minutos para texto legível (60→1h, 1440→1d, 90→1h30min) */
function formatMinutes(min: number): string {
    if (!min || min < 1) return '';
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    const days = Math.floor(h / 24);
    const remH = h % 24;
    if (days > 0) return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDept, setSelectedDept] = useState<Department | null | 'new'>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [workflows, setWorkflows] = useState<WorkflowRule[]>([]);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        const [deptsResult, agentsResult, workflowsResult] = await Promise.allSettled([
            DepartmentsService.findAll(),
            AIAgentsService.findAll(),
            WorkflowsService.findAll(),
        ]);

        if (deptsResult.status === 'fulfilled') {
            setDepartments(deptsResult.value);
        } else {
            toast.error('Erro ao carregar departamentos');
        }

        setAgents(agentsResult.status === 'fulfilled' ? agentsResult.value : []);
        setWorkflows(workflowsResult.status === 'fulfilled' ? workflowsResult.value : []);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (deletingId !== id) {
            setDeletingId(id);
            setTimeout(() => setDeletingId(prev => prev === id ? null : prev), 3000);
            return;
        }
        try {
            await DepartmentsService.remove(id);
            toast.success('Setor removido');
            setDeletingId(null);
            fetchData();
        } catch {
            toast.error('Erro ao remover setor');
            setDeletingId(null);
        }
    };

    const filteredDepartments = departments.filter(dep =>
        dep.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dep.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeCount = departments.filter(d => d.isActive).length;

    if (selectedDept) {
        return (
            <div className="space-y-12 max-w-7xl mx-auto relative liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] pt-6 pb-12">
                {/* key garante que o form reseta ao trocar de departamento */}
                <DepartmentFormView
                    key={selectedDept === 'new' ? 'new' : (selectedDept as Department).id}
                    department={selectedDept === 'new' ? null : selectedDept}
                    agents={agents}
                    workflows={workflows}
                    onClose={() => setSelectedDept(null)}
                    onSave={fetchData}
                />
            </div>
        );
    }

    return (
        <div className="space-y-12 max-w-7xl mx-auto relative liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10 px-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-4">
                        <LayoutDashboard className="text-primary h-10 w-10 shadow-[0_0_25px_rgba(2,132,199,0.3)]" />
                        Setores <span className="text-primary italic">Aero</span>
                    </h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 italic flex items-center gap-2">
                        <Activity size={14} className="text-primary" />
                        Motor de Inteligência e Distribuição KSZap
                        {!loading && (
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-black">
                                {activeCount}/{departments.length} ativos
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Localizar unidade..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-4 glass-heavy dark:bg-transparent border border-white/80 dark:border-white/10 rounded-[1.5rem] text-xs font-bold uppercase tracking-wider outline-none focus:ring-4 focus:ring-primary/10 transition-all w-72 shadow-xl"
                        />
                    </div>
                    <button
                        onClick={() => setSelectedDept('new')}
                        className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-[1.5rem] shadow-2xl shadow-primary/30 transition-all active:scale-95 font-bold text-xs uppercase tracking-widest group"
                    >
                        <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" />
                        <span>Nova Célula</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10 px-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-72 liquid-glass rounded-[3rem] animate-pulse" />
                    ))}
                </div>
            ) : filteredDepartments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 glass-heavy rounded-[4rem] border border-white/80 dark:border-white/10 mx-4 relative z-10 overflow-hidden group">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity blur-3xl rounded-full" />
                    <div className="h-28 w-28 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner transform rotate-12 group-hover:rotate-0 transition-transform">
                        <Building className="h-12 w-12 text-primary opacity-40" />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tighter italic">Vácuo Estrutural</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-12 text-center max-w-sm leading-relaxed italic opacity-80">
                        {searchTerm
                            ? `Nenhum setor encontrado para "${searchTerm}"`
                            : 'Nenhum setor foi detectado. Ative sua primeira unidade operacional.'}
                    </p>
                    {!searchTerm && (
                        <button
                            onClick={() => setSelectedDept('new')}
                            className="px-14 py-5 bg-primary text-white rounded-[2rem] font-bold text-sm uppercase tracking-widest shadow-2xl shadow-primary/40 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            Inicializar Unidade
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10 px-4">
                    {filteredDepartments.map((dept, index) => (
                        <motion.div
                            key={dept.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: index * 0.1 }}
                            whileHover={{ y: -12, scale: 1.02 }}
                            onClick={() => setSelectedDept(dept)}
                            className="liquid-glass dark:bg-transparent p-10 rounded-[3.5rem] border border-white/80 dark:border-white/10 shadow-2xl group relative overflow-hidden cursor-pointer"
                            style={{ borderColor: dept.color ? `${dept.color}40` : undefined }}
                        >
                            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: dept.color ? `${dept.color}20` : 'rgba(2,132,199,0.1)' }} />

                            <div className="flex justify-between items-start mb-10 relative z-10">
                                <div
                                    className="h-18 w-18 text-white rounded-[1.8rem] flex items-center justify-center text-4xl font-black shadow-2xl transform -rotate-12 group-hover:rotate-0 transition-all duration-500"
                                    style={{ backgroundColor: dept.color || '#2563eb', boxShadow: `0 20px 40px ${dept.color ? `${dept.color}40` : 'rgba(2,132,199,0.4)'}` }}
                                >
                                    {dept.emoji || dept.name.charAt(0)}
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedDept(dept); }}
                                        className="h-12 w-12 flex items-center justify-center bg-white dark:bg-white/5 hover:bg-primary hover:text-white text-slate-400 rounded-[1.2rem] transition-all shadow-xl border border-white/50 dark:border-white/10 active:scale-90"
                                        title="Editar"
                                    >
                                        <Pencil className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, dept.id)}
                                        className={`h-12 w-12 flex items-center justify-center rounded-[1.2rem] transition-all shadow-xl border active:scale-90 ${
                                            deletingId === dept.id
                                                ? 'bg-rose-500 text-white border-rose-500 animate-pulse'
                                                : 'bg-white dark:bg-white/5 hover:bg-rose-500 hover:text-white text-rose-500 border-white/50 dark:border-white/10'
                                        }`}
                                        title={deletingId === dept.id ? 'Clique novamente para confirmar' : 'Remover setor'}
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            {deletingId === dept.id && (
                                <div className="absolute inset-x-0 top-0 bg-rose-500/10 border-b border-rose-500/20 text-rose-500 text-[9px] font-black uppercase tracking-widest text-center py-1.5 rounded-t-[3.5rem]">
                                    Clique no lixo novamente para confirmar remoção
                                </div>
                            )}

                            <h3 className="font-black text-3xl text-slate-900 dark:text-white mb-3 tracking-tighter italic flex items-center gap-3">
                                {dept.name}
                                {dept.aiAgentId && <Shield size={16} className="text-primary animate-pulse" />}
                            </h3>
                            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[48px] leading-relaxed italic opacity-80 mb-8 border-l-2 border-primary/20 pl-4">
                                {dept.description || 'Unidade estratégica Aero Intelligence.'}
                            </p>

                            {/* SLA chips */}
                            {(dept.slaFirstResponseMin || dept.slaResolutionMin) && (
                                <div className="flex gap-2 mb-4">
                                    {dept.slaFirstResponseMin && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/5 text-primary text-[9px] font-black uppercase tracking-wider border border-primary/10">
                                            <Clock size={8} /> {formatMinutes(dept.slaFirstResponseMin)}
                                        </span>
                                    )}
                                    {dept.slaResolutionMin && (
                                        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[9px] font-black uppercase tracking-wider border border-slate-200 dark:border-white/5">
                                            <Activity size={8} /> {formatMinutes(dept.slaResolutionMin)}
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="pt-8 border-t border-slate-100 dark:border-white/5 flex items-center justify-between mt-2 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className={`h-3 w-3 rounded-full ${dept.isActive ? 'animate-pulse' : 'bg-slate-400'}`} style={{ backgroundColor: dept.isActive ? (dept.color || '#2563eb') : undefined, boxShadow: dept.isActive ? `0 0 8px ${dept.color || '#2563eb'}` : undefined }} />
                                    <span className="text-xs font-bold tracking-wider text-slate-400 uppercase italic">
                                        {dept.isActive ? 'Operacional' : 'Standby'}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    {dept.aiAgentId && (
                                        <div className="flex items-center gap-2.5 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-[1.1rem]">
                                            <Bot className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">IA</span>
                                        </div>
                                    )}
                                    {dept.workflowId && (
                                        <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-[1.1rem]">
                                            <Zap className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Fluxo</span>
                                        </div>
                                    )}
                                    {(dept as any).autoDistribute === false && (
                                        <div className="flex items-center gap-2.5 px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-[1.1rem]">
                                            <Share2 className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Manual</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}

function DepartmentFormView({
    department,
    agents,
    workflows,
    onClose,
    onSave,
}: {
    department: Department | null;
    agents: AIAgent[];
    workflows: WorkflowRule[];
    onClose: () => void;
    onSave: () => void;
}) {
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'geral' | 'horarios' | 'automacao'>('geral');

    const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<DepartmentForm>({
        resolver: zodResolver(departmentSchema),
        defaultValues: department ? {
            name: department.name,
            description: department.description || '',
            emoji: department.emoji || '💬',
            color: department.color || '#2563eb',
            slaFirstResponseMin: department.slaFirstResponseMin || 60,
            slaResolutionMin: department.slaResolutionMin || 1440,
            outOfHoursMessage: department.outOfHoursMessage || '',
            greetingMessage: (department as any).greetingMessage || '',
            timezone: (department as any).timezone || 'America/Sao_Paulo',
            aiAgentId: department.aiAgentId || '',
            workflowId: department.workflowId || '',
            defaultMode: department.defaultMode || 'AI',
            autoDistribute: (department as any).autoDistribute !== false,
            isActive: department.isActive ?? true,
            businessHours: (department.businessHours as any) || DEFAULT_HOURS,
        } : {
            name: '',
            description: '',
            emoji: '💬',
            color: '#2563eb',
            slaFirstResponseMin: 60,
            slaResolutionMin: 1440,
            outOfHoursMessage: '',
            greetingMessage: '',
            timezone: 'America/Sao_Paulo',
            aiAgentId: '',
            workflowId: '',
            defaultMode: 'AI',
            autoDistribute: true,
            isActive: true,
            businessHours: DEFAULT_HOURS,
        },
    });

    const businessHours = watch('businessHours');
    const selectedColor = watch('color');
    const selectedEmoji = watch('emoji');
    const slaFirst = watch('slaFirstResponseMin');
    const slaResolution = watch('slaResolutionMin');

    // Detectar quais tabs têm erros
    const tabErrors = {
        geral: !!(errors.name || errors.slaFirstResponseMin || errors.slaResolutionMin || errors.color || errors.emoji),
        horarios: !!(errors.outOfHoursMessage || errors.businessHours),
        automacao: !!(errors.aiAgentId || errors.workflowId || errors.defaultMode || errors.isActive || errors.autoDistribute),
    };

    const onSubmit = async (data: DepartmentForm) => {
        try {
            setSubmitting(true);
            const payload = {
                ...data,
                aiAgentId: data.aiAgentId || null,
                workflowId: data.workflowId || null,
            };
            if (department) {
                await DepartmentsService.update(department.id, payload);
                toast.success('Configurações atualizadas');
            } else {
                await DepartmentsService.create(payload);
                toast.success('Novo setor ativado');
            }
            onSave();
            onClose();
        } catch (error: any) {
            const msg = error.response?.data?.message;
            toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Erro ao processar requisição'));
        } finally {
            setSubmitting(false);
        }
    };

    const TABS = [
        { id: 'geral', label: 'Geral', icon: <Building size={14} /> },
        { id: 'horarios', label: 'Expediente', icon: <Clock size={14} /> },
        { id: 'automacao', label: 'Inteligência', icon: <Zap size={14} /> },
    ] as const;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-4xl mx-auto liquid-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-white/10 shadow-2xl flex flex-col"
        >
            <form
                onSubmit={handleSubmit(onSubmit, (errs) => {
                    // Procura recursivamente a primeira mensagem de erro
                    const findMsg = (obj: any): string | undefined => {
                        if (!obj || typeof obj !== 'object') return undefined;
                        if (typeof obj.message === 'string') return obj.message;
                        for (const v of Object.values(obj)) {
                            const found = findMsg(v);
                            if (found) return found;
                        }
                        return undefined;
                    };
                    // Navega para a tab com o primeiro erro
                    if (tabErrors.geral) setActiveTab('geral');
                    else if (tabErrors.horarios) setActiveTab('horarios');
                    else if (tabErrors.automacao) setActiveTab('automacao');
                    toast.error(findMsg(errs) || 'Corrija os campos obrigatórios');
                })}
                className="flex flex-col gap-0"
            >
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/10 pb-6">
                    <div className="flex items-center gap-4">
                        <div
                            className="h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center text-3xl md:text-4xl shadow-lg shadow-primary/10 transition-colors"
                            style={{ backgroundColor: selectedColor || '#2563eb' }}
                        >
                            {selectedEmoji}
                        </div>
                        <div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-xs font-black uppercase tracking-widest mb-1"
                            >
                                <ChevronLeft size={16} /> Voltar para Lista
                            </button>
                            <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-tight">
                                {department ? 'Configurar' : 'Novo'} <span className="text-primary italic">Setor</span>
                            </h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Arquitetura de Atendimento KSZap</p>
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
                            type="submit"
                            disabled={submitting}
                            className="flex-1 md:flex-none px-8 py-3 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {submitting ? <RefreshCcw className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                            {department ? 'Sincronizar' : 'Ativar Unidade'}
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 p-2 bg-slate-100/50 dark:bg-black/20 mx-6 mb-6 rounded-2xl border border-slate-200 dark:border-white/5">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
                                activeTab === tab.id
                                    ? 'bg-white dark:bg-white/10 text-primary shadow-sm border border-slate-200 dark:border-white/10'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'
                            }`}
                        >
                            {tab.icon} {tab.label}
                            {tabErrors[tab.id] && (
                                <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 space-y-8 pb-4">
                    {activeTab === 'geral' && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Identificação</label>
                                    <input
                                        {...register('name')}
                                        className={`w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold dark:text-white uppercase transition-colors ${errors.name ? 'border-rose-400' : 'border-slate-200 dark:border-white/10'}`}
                                        placeholder="NOME DO SETOR"
                                    />
                                    {errors.name && (
                                        <p className="text-rose-500 text-[10px] font-bold mt-1 ml-1 uppercase flex items-center gap-1">
                                            <AlertCircle size={10} /> {errors.name.message}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Diretriz (Emoji e Cor)</label>
                                    <div className="flex gap-2">
                                        <input
                                            {...register('emoji')}
                                            className="w-14 px-2 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-center text-lg shadow-inner outline-none"
                                            placeholder="🚀"
                                            maxLength={2}
                                        />
                                        <div className="relative flex-1">
                                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                                <Palette size={12} className="text-slate-400" />
                                            </div>
                                            <input
                                                type="color"
                                                {...register('color')}
                                                className="w-full h-full p-0 border-none bg-transparent cursor-pointer rounded-xl overflow-hidden min-h-[46px]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Propósito do Setor</label>
                                <textarea
                                    {...register('description')}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm italic h-24 resize-none"
                                    placeholder="Breve descrição das responsabilidades desta unidade..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2 ml-1">
                                        <Clock size={10} className="text-primary" /> SLA Resposta (min)
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        {...register('slaFirstResponseMin', { valueAsNumber: true })}
                                        className={`w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-white/5 outline-none font-bold text-sm transition-colors ${errors.slaFirstResponseMin ? 'border-rose-400' : 'border-slate-200 dark:border-white/10'}`}
                                    />
                                    <p className="text-[9px] font-bold text-primary/60 mt-1 ml-1">
                                        {slaFirst >= 1 ? `≈ ${formatMinutes(slaFirst)}` : ''}
                                    </p>
                                    {errors.slaFirstResponseMin && (
                                        <p className="text-rose-500 text-[10px] font-bold mt-1 ml-1 flex items-center gap-1">
                                            <AlertCircle size={10} /> {errors.slaFirstResponseMin.message}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2 ml-1">
                                        <Activity size={10} className="text-rose-500" /> SLA Resolução (min)
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        {...register('slaResolutionMin', { valueAsNumber: true })}
                                        className={`w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-white/5 outline-none font-bold text-sm transition-colors ${errors.slaResolutionMin ? 'border-rose-400' : 'border-slate-200 dark:border-white/10'}`}
                                    />
                                    <p className="text-[9px] font-bold text-rose-400/60 mt-1 ml-1">
                                        {slaResolution >= 1 ? `≈ ${formatMinutes(slaResolution)}` : ''}
                                    </p>
                                    {errors.slaResolutionMin && (
                                        <p className="text-rose-500 text-[10px] font-bold mt-1 ml-1 flex items-center gap-1">
                                            <AlertCircle size={10} /> {errors.slaResolutionMin.message}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'horarios' && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 mb-4 flex items-start gap-3">
                                <Clock size={14} className="text-primary mt-0.5 shrink-0" />
                                <p className="text-[10px] font-bold text-primary uppercase leading-relaxed tracking-wider italic">
                                    Configure o expediente de atendimento. Fora destes horários, o sistema aplicará o protocolo offline definido abaixo.
                                </p>
                            </div>

                            {/* Atalhos de seleção rápida */}
                            <div className="flex gap-2 flex-wrap">
                                {[
                                    { label: 'Dias Úteis', keys: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], off: ['saturday', 'sunday'] },
                                    { label: 'Todos os dias', keys: DAYS_OF_WEEK.map(d => d.key), off: [] },
                                    { label: 'Nenhum', keys: [], off: DAYS_OF_WEEK.map(d => d.key) },
                                ].map(({ label, keys, off }) => (
                                    <button
                                        key={label}
                                        type="button"
                                        onClick={() => {
                                            const current = businessHours || DEFAULT_HOURS;
                                            const updated = { ...current };
                                            keys.forEach(k => { updated[k] = { ...(updated[k] || { start: '08:00', end: '18:00' }), active: true }; });
                                            off.forEach(k => { updated[k] = { ...(updated[k] || { start: '08:00', end: '18:00' }), active: false }; });
                                            setValue('businessHours', updated);
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-primary/10 hover:text-primary border border-slate-200 dark:border-white/10 transition-all"
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-2">
                                {DAYS_OF_WEEK.map((day) => {
                                    const dayData = businessHours?.[day.key];
                                    const isActive = dayData?.active ?? false;
                                    return (
                                        <div key={day.key} className={`flex items-center gap-4 p-3 rounded-xl transition-colors border ${isActive ? 'bg-primary/3 border-primary/10 dark:border-primary/10' : 'border-transparent hover:border-slate-100 dark:hover:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                            <div className="flex items-center gap-3 w-36">
                                                <input
                                                    type="checkbox"
                                                    {...register(`businessHours.${day.key}.active` as any)}
                                                    className="w-5 h-5 rounded-md border-slate-300 text-primary cursor-pointer accent-primary"
                                                />
                                                <span className={`text-[10px] font-black uppercase tracking-tighter ${isActive ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                                                    {day.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-1 justify-end">
                                                <input
                                                    type="time"
                                                    {...register(`businessHours.${day.key}.start` as any)}
                                                    disabled={!isActive}
                                                    className="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold disabled:opacity-30 outline-none focus:ring-2 focus:ring-primary/20"
                                                />
                                                <span className="text-slate-300 text-xs">—</span>
                                                <input
                                                    type="time"
                                                    {...register(`businessHours.${day.key}.end` as any)}
                                                    disabled={!isActive}
                                                    className="bg-white dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold disabled:opacity-30 outline-none focus:ring-2 focus:ring-primary/20"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1 italic">Fuso Horário</label>
                                <select
                                    {...register('timezone')}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm font-bold"
                                >
                                    <option value="America/Sao_Paulo">América/São Paulo (UTC-3)</option>
                                    <option value="America/Manaus">América/Manaus (UTC-4)</option>
                                    <option value="America/Rio_Branco">América/Rio Branco (UTC-5)</option>
                                    <option value="America/Noronha">América/Noronha (UTC-2)</option>
                                    <option value="America/New_York">América/Nova York (UTC-5/-4)</option>
                                    <option value="America/Chicago">América/Chicago (UTC-6/-5)</option>
                                    <option value="America/Los_Angeles">América/Los Angeles (UTC-8/-7)</option>
                                    <option value="Europe/Lisbon">Europa/Lisboa (UTC+0/+1)</option>
                                    <option value="Europe/London">Europa/Londres (UTC+0/+1)</option>
                                    <option value="UTC">UTC</option>
                                </select>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1 italic">Mensagem de Boas-vindas</label>
                                <textarea
                                    {...register('greetingMessage')}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm italic h-20 resize-none"
                                    placeholder="Ex: Olá! Seja bem-vindo ao nosso suporte. Em breve um atendente irá te ajudar!"
                                />
                                <p className="text-[10px] text-slate-400 mt-1 ml-1">Enviada ao iniciar um novo atendimento. Se vazia, usa mensagem padrão.</p>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1 italic">Mensagem Fora de Expediente</label>
                                <textarea
                                    {...register('outOfHoursMessage')}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-primary/20 text-sm italic h-24 resize-none"
                                    placeholder="Ex: Olá! Nosso atendimento funciona de seg a sex, das 8h às 18h. Retornaremos em breve!"
                                />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'automacao' && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Cérebro IA</label>
                                    <select
                                        {...register('aiAgentId')}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none font-bold text-xs uppercase"
                                    >
                                        <option value="">Nenhum Agente</option>
                                        {agents.map(agent => (
                                            <option key={agent.id} value={agent.id}>{agent.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Fluxo Direcionador</label>
                                    <select
                                        {...register('workflowId')}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none font-bold text-xs uppercase"
                                    >
                                        <option value="">Distribuição Padrão</option>
                                        {workflows.map(wf => (
                                            <option key={wf.id} value={wf.id}>{wf.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Modo Operacional */}
                            <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block text-center italic">Modo Operacional Inicial do Ticket</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['AI', 'HUMANO', 'HIBRIDO'] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setValue('defaultMode', mode)}
                                            className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                                                watch('defaultMode') === mode
                                                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105'
                                                    : 'bg-white dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:border-primary/30'
                                            }`}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 text-center mt-4 uppercase tracking-tighter italic opacity-70">
                                    Determina como novos chamados serão tratados ao entrar nesta célula.
                                </p>
                            </div>

                            {/* Distribuição automática */}
                            <label className="flex items-center gap-4 p-5 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 cursor-pointer hover:bg-emerald-500/10 transition-all group">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        {...register('autoDistribute')}
                                        className="w-6 h-6 rounded-lg bg-white border-emerald-500 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                                    />
                                </div>
                                <div className="flex-1">
                                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] italic block">Distribuição Automática</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5 group-hover:text-emerald-500/70 transition-colors">Tickets recebidos serão distribuídos automaticamente entre os agentes disponíveis.</span>
                                </div>
                            </label>

                            {/* Status ativo */}
                            <label className="flex items-center gap-4 p-5 bg-primary/5 rounded-2xl border border-primary/10 cursor-pointer hover:bg-primary/10 transition-all group">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        {...register('isActive')}
                                        className="w-6 h-6 rounded-lg bg-white border-primary text-primary focus:ring-0 cursor-pointer"
                                    />
                                    {watch('isActive') && (
                                        <div className="absolute inset-0 bg-primary/20 animate-ping rounded-lg pointer-events-none" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic block">Unidade em Atividade</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5 group-hover:text-primary/70 transition-colors">A célula participará da distribuição de tráfego.</span>
                                </div>
                            </label>
                        </motion.div>
                    )}
                </div>
            </form>
        </motion.div>
    );
}
