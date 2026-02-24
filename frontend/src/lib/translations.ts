/**
 * Sistema centralizado de traduções para o KSZap
 * Mantém todas as traduções de enums e status em um único local
 */

// Status de Tickets
export const STATUS_TRANSLATIONS: Record<string, string> = {
    'OPEN': 'Aberto',
    'IN_PROGRESS': 'Em Atendimento',
    'WAITING': 'Aguardando',
    'RESOLVED': 'Resolvido',
    'CANCELLED': 'Cancelado',
};

// Prioridades
export const PRIORITY_TRANSLATIONS: Record<string, string> = {
    'HIGH': 'Alta',
    'MEDIUM': 'Média',
    'LOW': 'Baixa',
};

// Sentimentos (Análise de IA)
export const SENTIMENT_TRANSLATIONS: Record<string, string> = {
    'POSITIVE': 'Positivo',
    'NEUTRAL': 'Neutro',
    'NEGATIVE': 'Negativo',
};

// Roles/Perfis de Usuário
export const ROLE_TRANSLATIONS: Record<string, string> = {
    'ADMIN': 'Administrador',
    'SUPERVISOR': 'Supervisor',
    'AGENT': 'Atendente',
};

// Funções auxiliares para tradução
export const translateStatus = (status: string): string =>
    STATUS_TRANSLATIONS[status] || status;

export const translatePriority = (priority: string): string =>
    PRIORITY_TRANSLATIONS[priority] || priority;

export const translateSentiment = (sentiment: string): string =>
    SENTIMENT_TRANSLATIONS[sentiment] || sentiment;

export const translateRole = (role: string): string =>
    ROLE_TRANSLATIONS[role] || role;

// Cores para status (reutilizável em vários componentes)
export const getStatusColor = (status: string): string => {
    switch (status) {
        case 'OPEN':
            return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        case 'IN_PROGRESS':
            return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
        case 'WAITING':
            return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
        case 'RESOLVED':
            return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        case 'CANCELLED':
            return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        default:
            return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
};

// Cores para prioridades
export const getPriorityColor = (priority: string): string => {
    switch (priority) {
        case 'HIGH':
            return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        case 'MEDIUM':
            return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
        case 'LOW':
            return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        default:
            return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
};

// Cores para sentimentos
export const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
        case 'POSITIVE':
            return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        case 'NEUTRAL':
            return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
        case 'NEGATIVE':
            return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        default:
            return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
};
