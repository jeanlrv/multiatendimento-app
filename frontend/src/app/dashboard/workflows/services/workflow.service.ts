import {
    WorkflowRule,
    WorkflowExecution,
    WorkflowStats
} from '../types/workflow.types';
import { api } from '@/services/api';

export const workflowService = {
    /* ========================================
       RULES
    ======================================== */

    async getRules(): Promise<WorkflowRule[]> {
        const res = await api.get('/workflows');
        return res.data;
    },

    async createRule(
        data: Partial<WorkflowRule>
    ): Promise<WorkflowRule> {
        const res = await api.post('/workflows', data);
        return res.data;
    },

    async updateRule(
        id: string,
        data: Partial<WorkflowRule>
    ): Promise<WorkflowRule> {
        const res = await api.patch(`/workflows/${id}`, data);
        return res.data;
    },

    async duplicateRule(id: string): Promise<WorkflowRule> {
        const res = await api.post(`/workflows/${id}/duplicate`);
        return res.data;
    },

    async deleteRule(id: string): Promise<void> {
        await api.delete(`/workflows/${id}`);
    },

    async runRule(
        id: string
    ): Promise<{ executionId: string }> {
        const res = await api.post(`/workflows/${id}/run`);
        return res.data;
    },

    /* ========================================
       EXECUTIONS
    ======================================== */

    async getExecutions(params: {
        page?: number;
        limit?: number;
        status?: string;
        ruleId?: string;
    }): Promise<{
        items: WorkflowExecution[];
        total: number;
    }> {
        const res = await api.get('/workflows/executions', { params });
        return res.data;
    },

    async getStats(id: string): Promise<WorkflowStats> {
        const res = await api.get(`/workflows/${id}/stats`);
        return res.data;
    },

    async getAllStats(): Promise<Record<string, { totalExecutions: number; totalFailures: number; successRate: number }>> {
        try {
            const res = await api.get('/workflows/stats/all');
            return res.data;
        } catch {
            return {};
        }
    },

    async getAnalytics(): Promise<any> {
        try {
            const res = await api.get('/workflows/analytics');
            return res.data;
        } catch {
            return null;
        }
    },

    async simulate(data: {
        ruleId?: string;
        payload: any;
        event: string;
        nodes?: any[];
        edges?: any[];
    }): Promise<any> {
        const res = await api.post('/workflows/simulate', data);
        return res.data;
    },

    /* ========================================
       VERSIONAMENTO
    ======================================== */

    async getVersions(ruleId: string): Promise<any[]> {
        const response = await api.get(`/workflows/${ruleId}/versions`);
        return response.data;
    },

    async createVersion(
        ruleId: string,
        description: string,
        createdBy: string
    ): Promise<any> {
        const response = await api.post(
            `/workflows/${ruleId}/versions`,
            { description, createdBy }
        );
        return response.data;
    },

    async restoreVersion(
        ruleId: string,
        versionId: string
    ): Promise<any> {
        const response = await api.post(
            `/workflows/${ruleId}/versions/${versionId}/restore`
        );
        return response.data;
    }
};
