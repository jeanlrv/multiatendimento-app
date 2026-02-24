import { api } from './api';

export interface UserDepartment {
    id: string;
    userId: string;
    departmentId: string;
    department: {
        id: string;
        name: string;
        emoji?: string;
        color?: string;
    };
}

export interface UserRole {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
}

export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    roleId: string;
    role: UserRole;
    isActive: boolean;
    companyId: string;
    createdAt: string;
    updatedAt: string;
    departments: UserDepartment[];
}

export interface CreateUserPayload {
    name: string;
    email: string;
    password: string;
    roleId: string;
    departmentIds?: string[];
    isActive?: boolean;
}

export interface UpdateUserPayload {
    name?: string;
    email?: string;
    password?: string;
    roleId?: string;
    departmentIds?: string[];
    isActive?: boolean;
}

export const usersService = {
    findAll: async (): Promise<User[]> => {
        const response = await api.get<User[]>('/users');
        return response.data;
    },

    findOne: async (id: string): Promise<User> => {
        const response = await api.get<User>(`/users/${id}`);
        return response.data;
    },

    create: async (data: CreateUserPayload): Promise<User> => {
        const response = await api.post<User>('/users', data);
        return response.data;
    },

    update: async (id: string, data: UpdateUserPayload): Promise<User> => {
        const response = await api.patch<User>(`/users/${id}`, data);
        return response.data;
    },

    toggleStatus: async (id: string, isActive: boolean): Promise<User> => {
        const response = await api.patch<User>(`/users/${id}`, { isActive });
        return response.data;
    },

    remove: async (id: string): Promise<void> => {
        await api.delete(`/users/${id}`);
    },

    getMentionable: async () => {
        const response = await api.get('/users/mentionable');
        return response.data;
    },

    getMe: async () => {
        const response = await api.get('/users/me');
        return response.data;
    },

    updateMe: async (data: { name?: string; avatar?: string }) => {
        const response = await api.patch('/users/me', data);
        return response.data;
    },
};
