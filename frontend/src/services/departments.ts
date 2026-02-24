import { api } from './api';

export interface Department {
    id: string;
    name: string;
    description?: string;
    emoji?: string;
    color?: string;
    displayOrder?: number;
    businessHours?: any;
    slaFirstResponseMin?: number;
    slaResolutionMin?: number;
    outOfHoursMessage?: string;
    aiAgentId?: string | null;
    workflowId?: string | null;
    defaultMode?: 'AI' | 'HUMANO' | 'HIBRIDO';
    autoDistribute?: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export const DepartmentsService = {
    findAll: async () => {
        const response = await api.get<Department[]>('/departments');
        return response.data;
    },

    create: async (data: Partial<Department>) => {
        const response = await api.post<Department>('/departments', data);
        return response.data;
    },

    update: async (id: string, data: Partial<Department>) => {
        const response = await api.patch<Department>(`/departments/${id}`, data);
        return response.data;
    },

    remove: async (id: string) => {
        await api.delete(`/departments/${id}`);
    }
};

