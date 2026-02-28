'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    History,
    Search,
    Settings,
    Activity,
    Plus,
    BarChart3,
    Binary,
    Layers,
    Clock,
    Save,
    CheckCircle2,
    XCircle,
    Download
} from 'lucide-react';

import { toast, Toaster } from 'sonner';
import WorkflowBuilder, { WorkflowBuilderRef } from './builder/WorkflowBuilder';
import WorkflowCard from './components/WorkflowCard';
import ExecutionDrawer from './components/ExecutionDrawer';
import SimulateModal from './components/SimulateModal';

import { useWorkflows } from './hooks/useWorkflows';
import { workflowService } from './services/workflow.service';
import {
    WorkflowExecution,
    WorkflowRule,
    WorkflowNode,
    WorkflowEdge
} from './types/workflow.types';

export default function WorkflowsPage() {

    const {
        rules,
        ruleStats,
        loadingRules,
        analytics,
        loadingAnalytics,
        useExecutions,
        toggleRule,
        duplicateRule,
        deleteRule,
        runRule,
        updateRule,
        createRule
    } = useWorkflows();

    const [activeTab, setActiveTab] =
        useState<'rules' | 'history' | 'builder' | 'analytics'>('rules');

    const [ruleSearch, setRuleSearch] = useState('');
    const [executionStatusFilter, setExecutionStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [selectedExecution, setSelectedExecution] =
        useState<WorkflowExecution | null>(null);

    const [simulatingRule, setSimulatingRule] =
        useState<{ id: string; name: string } | null>(null);

    const builderRef = useRef<WorkflowBuilderRef>(null);

    const [editingRule, setEditingRule] =
        useState<WorkflowRule | null>(null);

    const [isCreating, setIsCreating] = useState(false);
    const [newRuleName, setNewRuleName] = useState('');
    const [newRuleDescription, setNewRuleDescription] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);

                await createRule({
                    name: json.name ? `${json.name} (Importado)` : 'Novo Fluxo Importado',
                    description: json.description || '',
                    nodes: json.nodes || [],
                    edges: json.edges || [],
                    environment: 'PRODUCTION',
                    priority: 1
                });
                toast.success('Fluxo importado com sucesso!');
            } catch (err) {
                toast.error('Erro ao ler arquivo JSON de importação.');
            }
        };
        reader.readAsText(file);

        // reset input so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleExport = (rule: WorkflowRule) => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
            name: rule.name,
            description: rule.description,
            nodes: rule.nodes,
            edges: rule.edges
        }, null, 2));

        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", rule.name.toLowerCase().replace(/\s+/g, '_') + "_export.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast.success(`Fluxo exportado como JSON!`);
    };

    /* =========================================================
       EXECUÇÕES
    ========================================================= */

    const { data: executionsData, isLoading: loadingExecutions } =
        useExecutions({
            page,
            limit: 10,
            status: executionStatusFilter || undefined
        });

    const executions = executionsData?.items || [];
    const totalExecutions = executionsData?.total || 0;

    /* =========================================================
       FILTRO REGRAS
    ========================================================= */

    const filteredRules = useMemo(() =>
        rules.filter((rule: WorkflowRule) =>
            rule.name.toLowerCase().includes(ruleSearch.toLowerCase())
        ),
        [rules, ruleSearch]
    );

    /* =========================================================
       VALIDAÇÃO DO FLUXO
    ========================================================= */

    const validateWorkflowGraph = (
        nodes: WorkflowNode[],
        edges: WorkflowEdge[]
    ) => {

        if (!nodes.length)
            return 'O fluxo está vazio.';

        const triggers = nodes.filter(n => n.type === 'trigger');
        if (triggers.length === 0)
            return 'É necessário um Gatilho.';

        if (triggers.length > 1)
            return 'A automação deve ter apenas um Gatilho.';

        const actions = nodes.filter(n => n.type === 'action');
        if (actions.length === 0)
            return 'Adicione pelo menos uma Ação.';

        const invalidDelay = nodes.find(
            n => n.type === 'delay' &&
                (!n.data.delayMs || n.data.delayMs <= 0)
        );

        if (invalidDelay)
            return 'Existe um Delay sem tempo configurado.';

        return null;
    };

    /* =========================================================
       SALVAR
    ========================================================= */

    const handleSaveWorkflow = async () => {

        if (!builderRef.current) return;

        const graph = builderRef.current.getGraph();

        const validationError = validateWorkflowGraph(
            graph.nodes as WorkflowNode[],
            graph.edges as WorkflowEdge[]
        );

        if (validationError) {
            toast.error(validationError);
            return;
        }

        try {

            if (editingRule) {

                await updateRule(editingRule.id, {
                    nodes: graph.nodes,
                    edges: graph.edges
                });

                await workflowService.createVersion(
                    editingRule.id,
                    'Alteração via Editor Visual',
                    'system'
                );

                toast.success('Automação atualizada com sucesso!');

            } else {

                if (!newRuleName.trim()) {
                    toast.error('Informe o nome da automação.');
                    return;
                }

                await createRule({
                    name: newRuleName,
                    description: newRuleDescription,
                    nodes: graph.nodes,
                    edges: graph.edges,
                    environment: 'PRODUCTION',
                    priority: 1
                });

                toast.success('Automação criada com sucesso!');
            }

            setActiveTab('rules');
            setEditingRule(null);
            setIsCreating(false);

        } catch {
            toast.error('Erro ao salvar automação.');
        }
    };

    /* =========================================================
       UI
    ========================================================= */

    return (
        <div className="liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl space-y-10 pb-16">

            <Toaster position="bottom-right" richColors />

            {/* HEADER PREMIUM */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10 px-6 py-4">

                <div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                        Central de <span className="text-primary">Automações</span>
                    </h1>

                    <div className="flex items-center gap-4 mt-3">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500">
                            {rules.filter(r => r.isActive).length} Ativas
                        </span>

                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            Total: {rules.length}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 px-6 py-3 rounded-2xl font-bold text-[11px] uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2 border border-slate-200 dark:border-white/10"
                    >
                        <Download size={16} className="rotate-180" />
                        Importar
                    </button>
                    <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImport} />

                    <button
                        onClick={() => {
                            setEditingRule(null);
                            setIsCreating(true);
                            setNewRuleName('');
                            setNewRuleDescription('');
                            setActiveTab('builder');
                        }}
                        className="bg-primary text-white px-6 py-3 rounded-2xl font-bold text-[11px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Nova Automação
                    </button>
                </div>
            </div>

            {/* TABS */}

            <div className="flex gap-4 px-4 border-b border-slate-200 dark:border-slate-800 pb-2 mb-6">

                <button
                    onClick={() => setActiveTab('rules')}
                    className={`px-4 py-2 font-bold text-sm transition-colors ${activeTab === 'rules' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Regras
                </button>

                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 font-bold text-sm transition-colors ${activeTab === 'history' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Histórico
                </button>

                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`px-4 py-2 font-bold text-sm transition-colors ${activeTab === 'analytics' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Analytics
                </button>

                <button
                    onClick={() => setActiveTab('builder')}
                    className={`px-4 py-2 font-bold text-sm transition-colors ${activeTab === 'builder' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Editor Visual
                </button>
            </div>

            <AnimatePresence mode="wait">

                {/* =========================
                   BUILDER
                ========================= */}

                {activeTab === 'builder' && (
                    <motion.div
                        key="builder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="px-4"
                    >

                        {isCreating && (
                            <div className="mb-6 space-y-3">
                                <input
                                    placeholder="Nome da Automação"
                                    value={newRuleName}
                                    onChange={(e) =>
                                        setNewRuleName(e.target.value)
                                    }
                                    className="w-full border p-3 rounded-lg"
                                />

                                <textarea
                                    placeholder="Descrição"
                                    value={newRuleDescription}
                                    onChange={(e) =>
                                        setNewRuleDescription(e.target.value)
                                    }
                                    className="w-full border p-3 rounded-lg"
                                />
                            </div>
                        )}

                        <WorkflowBuilder
                            ref={builderRef}
                            initialRule={editingRule}
                        />

                        <div className="flex justify-end gap-4 mt-6">
                            <button
                                onClick={() => {
                                    setActiveTab('rules');
                                    setEditingRule(null);
                                    setIsCreating(false);
                                }}
                                className="px-4 py-2 text-gray-500"
                            >
                                Cancelar
                            </button>

                            <button
                                onClick={handleSaveWorkflow}
                                className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
                            >
                                <Save size={14} />
                                Salvar Automação
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* =========================
                   REGRAS
                ========================= */}

                {activeTab === 'rules' && (
                    <motion.div
                        key="rules"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="px-4 space-y-4"
                    >
                        <input
                            placeholder="Buscar automação..."
                            value={ruleSearch}
                            onChange={(e) => setRuleSearch(e.target.value)}
                            className="w-full max-w-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredRules.map((rule) => (
                                <WorkflowCard
                                    key={rule.id}
                                    rule={rule}
                                    stats={ruleStats[rule.id]}
                                    onEdit={() => {
                                        setEditingRule(rule);
                                        setIsCreating(false);
                                        setActiveTab('builder');
                                    }}
                                    onDuplicate={duplicateRule}
                                    onDelete={deleteRule}
                                    onRun={runRule}
                                    onToggle={toggleRule}
                                    onSimulate={() =>
                                        setSimulatingRule({
                                            id: rule.id,
                                            name: rule.name
                                        })
                                    }
                                    onExport={handleExport}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* =========================
                   HISTÓRICO
                ========================= */}

                {activeTab === 'history' && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="px-4 space-y-4"
                    >
                        <div className="flex items-center gap-3">
                            <select
                                value={executionStatusFilter}
                                onChange={(e) => { setExecutionStatusFilter(e.target.value); setPage(1); }}
                                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900"
                            >
                                <option value="">Todos os status</option>
                                <option value="success">Sucesso</option>
                                <option value="failed">Falhou</option>
                                <option value="running">Em execução</option>
                                <option value="waiting_event">Aguardando evento</option>
                                <option value="delayed">Aguardando delay</option>
                            </select>
                            {totalExecutions > 0 && (
                                <span className="text-xs text-slate-500">{totalExecutions} execuções</span>
                            )}
                        </div>

                        {loadingExecutions && (
                            <p>Carregando execuções...</p>
                        )}

                        {!loadingExecutions && (
                            <div className="space-y-4">
                                {executions.map((exec: any) => (
                                    <div
                                        key={exec.id}
                                        className="p-4 border rounded-lg cursor-pointer"
                                        onClick={() =>
                                            setSelectedExecution(exec)
                                        }
                                    >
                                        <div className="flex justify-between">
                                            <span className="font-bold">
                                                {exec.workflowRule.name}
                                            </span>

                                            <span className={`font-bold ${exec.status === 'success'
                                                ? 'text-green-600'
                                                : 'text-red-600'
                                                }`}>
                                                {exec.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {/* Paginação */}
                                {totalExecutions > 10 && (
                                    <div className="flex items-center justify-center gap-4 pt-4">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="px-4 py-2 rounded-lg border text-sm font-bold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            ← Anterior
                                        </button>
                                        <span className="text-sm text-slate-500">
                                            Pág. {page} de {Math.ceil(totalExecutions / 10)}
                                        </span>
                                        <button
                                            onClick={() => setPage(p => p + 1)}
                                            disabled={page >= Math.ceil(totalExecutions / 10)}
                                            className="px-4 py-2 rounded-lg border text-sm font-bold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            Próxima →
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* =========================
                   ANALYTICS (NOVO 3.3)
                ========================= */}

                {activeTab === 'analytics' && (
                    <motion.div
                        key="analytics"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="px-4 space-y-8"
                    >
                        {loadingAnalytics ? (
                            <p className="text-slate-500 text-sm">Carregando métricas...</p>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Card 1 */}
                                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-xl flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                            <Activity size={24} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total de Execuções</p>
                                            <h3 className="text-3xl font-black text-slate-800 dark:text-white">
                                                {analytics?.totalExecutions || 0}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Card 2 */}
                                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-xl flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                                            <XCircle size={24} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Taxa de Falha</p>
                                            <h3 className="text-3xl font-black text-rose-500">
                                                {Number(analytics?.failureRate || 0).toFixed(1)}%
                                            </h3>
                                        </div>
                                    </div>

                                    {/* Card 3 */}
                                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-xl flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                            <Clock size={24} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tempo Médio</p>
                                            <h3 className="text-3xl font-black text-slate-800 dark:text-white">
                                                {analytics?.averageDuration || 0} <span className="text-sm font-bold text-slate-400">ms</span>
                                            </h3>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-white/10 shadow-xl">
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6">Desempenho por Automação</h3>
                                    <div className="space-y-4">
                                        {rules.map(rule => {
                                            const stats = ruleStats[rule.id];
                                            if (!stats || stats.totalExecutions === 0) return null;
                                            return (
                                                <div key={rule.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                                    <div className="flex-1">
                                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{rule.name}</h4>
                                                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 mt-2 rounded-full overflow-hidden flex">
                                                            <div className="bg-emerald-500 h-full" style={{ width: `${stats.successRate}%` }} />
                                                            <div className="bg-rose-500 h-full" style={{ width: `${100 - stats.successRate}%` }} />
                                                        </div>
                                                    </div>
                                                    <div className="ml-6 text-right">
                                                        <p className="text-xs font-bold text-slate-500">{stats.totalExecutions} runs</p>
                                                        <p className="text-xs font-bold text-emerald-500">{stats.successRate.toFixed(1)}% aprovados</p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {rules.every(r => !ruleStats[r.id] || ruleStats[r.id].totalExecutions === 0) && (
                                            <p className="text-sm text-slate-500 italic text-center py-4">Nenhuma automação rodou ainda.</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* DRAWERS */}

            <ExecutionDrawer
                execution={selectedExecution}
                onClose={() =>
                    setSelectedExecution(null)
                }
            />

            {simulatingRule && (
                <SimulateModal
                    isOpen={true}
                    ruleId={simulatingRule.id}
                    ruleName={simulatingRule.name}
                    onClose={() =>
                        setSimulatingRule(null)
                    }
                    onSimulate={async (data) => {
                        const res =
                            await workflowService.simulate({
                                ...data,
                                ruleId: simulatingRule.id
                            });

                        if (res.success)
                            toast.success('Simulação concluída!');
                        else
                            toast.error('Falha na simulação.');

                        return res;
                    }}
                />
            )}
        </div>
    );
}
