import { api } from './api';

export interface Role {
    id: string;
    name: string;
    description?: string | null;
    permissions: string[];
    companyId: string;
    createdAt: string;
    updatedAt: string;
    _count?: { users: number };
}

export interface CreateRolePayload {
    name: string;
    description?: string;
    permissions: string[];
}

export interface UpdateRolePayload {
    name?: string;
    description?: string;
    permissions?: string[];
}

export const rolesService = {
    findAll: async (): Promise<Role[]> => {
        const r = await api.get<Role[]>('/roles');
        return r.data;
    },

    findOne: async (id: string): Promise<Role> => {
        const r = await api.get<Role>(`/roles/${id}`);
        return r.data;
    },

    create: async (data: CreateRolePayload): Promise<Role> => {
        const r = await api.post<Role>('/roles', data);
        return r.data;
    },

    update: async (id: string, data: UpdateRolePayload): Promise<Role> => {
        const r = await api.patch<Role>(`/roles/${id}`, data);
        return r.data;
    },

    remove: async (id: string): Promise<void> => {
        await api.delete(`/roles/${id}`);
    },
};
