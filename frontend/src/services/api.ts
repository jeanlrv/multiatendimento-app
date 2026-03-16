import axios, { AxiosRequestConfig } from 'axios';

export const api = axios.create({
    baseURL: '/api',
    withCredentials: true, // envia httpOnly cookies automaticamente em toda request
});

// ─── Auto-refresh — trata 401 tentando renovar o access_token via cookie ──────
let isRefreshing = false;
let failedQueue: Array<{ resolve: () => void; reject: (error: unknown) => void }> = [];

const processQueue = (error: unknown) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve();
    });
    failedQueue = [];
};

const clearAuthAndRedirect = () => {
    // Limpa dados de perfil do localStorage (tokens já foram limpos pelo servidor via cookie)
    localStorage.removeItem('user');
    localStorage.removeItem('company');
    document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
    }
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Só tenta refresh em 401 não repetido e fora dos endpoints de auth
        const isAuthEndpoint =
            originalRequest.url?.includes('/auth/refresh') ||
            originalRequest.url?.includes('/auth/logout') ||
            originalRequest.url?.includes('/auth/login');

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
            if (isRefreshing) {
                // Outros requests aguardam na fila enquanto o refresh acontece
                return new Promise<void>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(() => {
                    return api(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // refresh_token está no httpOnly cookie — enviado automaticamente
                await axios.post('/api/auth/refresh', {}, { withCredentials: true });

                processQueue(null);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError);
                clearAuthAndRedirect();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // Retry automático para erros 5xx (máx 2 tentativas, backoff exponencial)
        const originalRequestWithRetry = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number };
        if (error.response?.status >= 500 && !originalRequestWithRetry._retry) {
            originalRequestWithRetry._retryCount = (originalRequestWithRetry._retryCount ?? 0) + 1;
            if (originalRequestWithRetry._retryCount <= 2) {
                const delay = 500 * Math.pow(2, originalRequestWithRetry._retryCount - 1); // 500ms, 1s
                await new Promise(r => setTimeout(r, delay));
                return api(originalRequestWithRetry);
            }
        }

        return Promise.reject(error);
    }
);
