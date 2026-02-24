'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { workflowService } from '../services/workflow.service';
import { WorkflowRule, WorkflowStats } from '../types/workflow.types';
import { toast } from 'sonner';

export function useWorkflows() {
    const [rules, setRules] = useState<WorkflowRule[]>([]);
    const [ruleStats, setRuleStats] = useState<Record<string, WorkflowStats>>({});
    const [analytics, setAnalytics] = useState<any>(null);
    const [loadingRules, setLoadingRules] = useState(true);
    const [loadingAnalytics, setLoadingAnalytics] = useState(true);
    const rulesLengthRef = useRef(0);

    const fetchRules = useCallback(async () => {
        try {
            setLoadingRules(true);
            const data = await workflowService.getRules();
            setRules(data);
            rulesLengthRef.current = data.length;
        } catch {
            toast.error('Erro ao carregar regras de workflow.');
        } finally {
            setLoadingRules(false);
        }
    }, []);

    const fetchStats = useCallback(async () => {
        if (rulesLengthRef.current === 0) return;
        try {
            const data = await workflowService.getAllStats();
            setRuleStats(data as unknown as Record<string, WorkflowStats>);
        } catch {
            // stats são opcionais, silencioso
        }
    }, []);

    const fetchAnalytics = useCallback(async () => {
        try {
            setLoadingAnalytics(true);
            const data = await workflowService.getAnalytics();
            setAnalytics(data);
        } catch {
            // analytics são opcionais, silencioso
        } finally {
            setLoadingAnalytics(false);
        }
    }, []);

    useEffect(() => {
        fetchRules();
        fetchAnalytics();
    }, [fetchRules, fetchAnalytics]);

    // Busca stats após regras carregadas
    useEffect(() => {
        if (rules.length > 0) {
            fetchStats();
        }
    }, [rules.length, fetchStats]);

    // Hook interno para buscar execuções com paginação
    const useExecutions = (params: { page?: number; limit?: number; status?: string; ruleId?: string }) => {
        const [data, setData] = useState<any>(null);
        const [isLoading, setIsLoading] = useState(true);
        const paramsKey = JSON.stringify(params);

        useEffect(() => {
            let cancelled = false;
            setIsLoading(true);
            workflowService.getExecutions(params)
                .then(result => { if (!cancelled) setData(result); })
                .catch(() => { if (!cancelled) setData(null); })
                .finally(() => { if (!cancelled) setIsLoading(false); });
            return () => { cancelled = true; };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [paramsKey]);

        return { data, isLoading };
    };

    const toggleRule = useCallback(async (id: string, active: boolean) => {
        try {
            await workflowService.updateRule(id, { isActive: active });
            setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: active } : r));
            toast.success('Status da regra atualizado!');
        } catch {
            toast.error('Erro ao alternar status da regra.');
        }
    }, []);

    const duplicateRule = useCallback(async (id: string) => {
        try {
            await workflowService.duplicateRule(id);
            await fetchRules();
            toast.success('Regra duplicada com sucesso!');
        } catch {
            toast.error('Erro ao duplicar regra.');
        }
    }, [fetchRules]);

    const deleteRule = useCallback(async (id: string) => {
        if (!confirm('Deseja realmente excluir esta regra?')) return;
        try {
            await workflowService.deleteRule(id);
            setRules(prev => prev.filter(r => r.id !== id));
            toast.success('Regra excluída!');
        } catch {
            toast.error('Erro ao excluir regra.');
        }
    }, []);

    const runRule = useCallback(async (id: string) => {
        try {
            await workflowService.runRule(id);
            toast.success('Workflow adicionado à fila de execução!');
        } catch {
            toast.error('Erro ao executar regra manualmente.');
        }
    }, []);

    const updateRule = useCallback(async (id: string, data: Partial<WorkflowRule>) => {
        const result = await workflowService.updateRule(id, data);
        setRules(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
        return result;
    }, []);

    const createRule = useCallback(async (data: Partial<WorkflowRule>) => {
        const result = await workflowService.createRule(data);
        await fetchRules();
        toast.success('Workflow criado com sucesso!');
        return result;
    }, [fetchRules]);

    const refreshRules = useCallback(() => {
        fetchRules();
        fetchStats();
    }, [fetchRules, fetchStats]);

    return {
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
        createRule,
        refreshRules,
    };
}
