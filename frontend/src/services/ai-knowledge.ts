import { api } from './api';

export interface KnowledgeBase {
    id: string;
    name: string;
    description?: string;
    companyId: string;
    embeddingProvider?: string;
    embeddingModel?: string;
    webhookEnabled?: boolean;
    webhookApiKey?: string;
    createdAt: string;
    updatedAt: string;
    _count?: {
        documents: number;
    };
}

export interface KBSyncLog {
    id: string;
    knowledgeBaseId: string;
    filename: string;
    fileSize?: number;
    status: 'SUCCESS' | 'REPLACED' | 'ERROR';
    errorMessage?: string;
    documentId?: string;
    agentHostname?: string;
    createdAt: string;
}

export interface AIDocument {
    id: string;
    knowledgeBaseId: string;
    title: string;
    sourceType: string;
    contentUrl?: string;
    rawContent?: string;
    status: 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';
    chunkCount: number;
    vectorizedCount?: number;
    isVectorized?: boolean;
    error?: string;
    createdAt: string;
    updatedAt: string;
}

export const AIKnowledgeService = {
    findAllBases: async (signal?: AbortSignal) => {
        const response = await api.get<KnowledgeBase[]>('/ai/knowledge/bases', { signal });
        return response.data;
    },

    findOneBase: async (id: string) => {
        const response = await api.get<KnowledgeBase & { documents: AIDocument[] }>(`/ai/knowledge/bases/${id}`);
        return response.data;
    },

    createBase: async (data: Partial<KnowledgeBase>) => {
        const response = await api.post<KnowledgeBase>('/ai/knowledge/bases', data);
        return response.data;
    },

    removeBase: async (id: string) => {
        await api.delete(`/ai/knowledge/bases/${id}`);
    },

    updateBase: async (id: string, data: Partial<KnowledgeBase>) => {
        const response = await api.patch<KnowledgeBase>(`/ai/knowledge/bases/${id}`, data);
        return response.data;
    },

    addDocument: async (baseId: string, data: Partial<AIDocument>) => {
        const response = await api.post<AIDocument>(`/ai/knowledge/bases/${baseId}/documents`, data);
        return response.data;
    },

    uploadDocument: async (baseId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<AIDocument>(`/ai/knowledge/bases/${baseId}/upload`, formData);
        return response.data;
    },

    getDocumentStatus: async (id: string) => {
        const response = await api.get<AIDocument>(`/ai/knowledge/documents/${id}/status`);
        return response.data;
    },

    removeDocument: async (id: string) => {
        await api.delete(`/ai/knowledge/documents/${id}`);
    },

    reprocessDocument: async (documentId: string): Promise<{ message: string }> => {
        const response = await api.post<{ message: string }>(`/ai/knowledge/documents/${documentId}/reprocess`);
        return response.data;
    },

    reprocessBase: async (baseId: string): Promise<{ message: string; count: number }> => {
        const response = await api.post<{ message: string; count: number }>(`/ai/knowledge/bases/${baseId}/reprocess-all`);
        return response.data;
    },

    downloadDocument: async (documentId: string, title: string) => {
        const response = await api.get(`/ai/knowledge/documents/${documentId}/download`, {
            responseType: 'blob'
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', title);
        document.body.appendChild(link);
        link.click();
        link.remove();
    },

    batchRemoveDocuments: async (ids: string[]) => {
        await api.delete('/ai/knowledge/documents/bulk', { data: { ids } });
    },

    downloadBulkDocuments: async (ids: string[]) => {
        const response = await api.post('/ai/knowledge/documents/download-bulk', { ids }, {
            responseType: 'blob'
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'knowledge-base-documents.zip');
        document.body.appendChild(link);
        link.click();
        link.remove();
    },

    // ── Integração Local (Agente Windows) ──────────────────────────────────

    enableWebhook: async (kbId: string): Promise<{ apiKey: string }> => {
        const response = await api.post<{ apiKey: string }>(`/ai/knowledge/bases/${kbId}/webhook`);
        return response.data;
    },

    disableWebhook: async (kbId: string): Promise<void> => {
        await api.delete(`/ai/knowledge/bases/${kbId}/webhook`);
    },

    rotateWebhookKey: async (kbId: string): Promise<{ apiKey: string }> => {
        const response = await api.post<{ apiKey: string }>(`/ai/knowledge/bases/${kbId}/webhook/rotate`);
        return response.data;
    },

    getSyncLogs: async (kbId: string, limit = 50): Promise<KBSyncLog[]> => {
        const response = await api.get<KBSyncLog[]>(`/ai/knowledge/bases/${kbId}/sync-logs?limit=${limit}`);
        return response.data;
    },
};


