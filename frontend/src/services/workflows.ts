import { api } from './api';

export interface WorkflowRule {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
    priority: number;
}

export const WorkflowsService = {
    findAll: async () => {
        const response = await api.get<WorkflowRule[]>('/workflows');
        return response.data;
    }
};
