import axios, { AxiosRequestConfig } from 'axios';

export const api = axios.create({
    baseURL: '/api',
});

// ─── Request interceptor — injeta token em cada request ────────────────────────
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ─── Auto-refresh — trata 401 tentando renovar o access_token ─────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(token!);
    });
    failedQueue = [];
};

const clearAuthAndRedirect = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('company');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
    }
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Só tenta refresh em 401 não repetido e fora do endpoint de refresh/logout
        const isAuthEndpoint =
            originalRequest.url?.includes('/auth/refresh') ||
            originalRequest.url?.includes('/auth/logout') ||
            originalRequest.url?.includes('/auth/login');

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
            const refreshToken = localStorage.getItem('refresh_token');

            if (!refreshToken) {
                clearAuthAndRedirect();
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // Outros requests aguardam na fila enquanto o refresh acontece
                return new Promise<string>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers = originalRequest.headers || {};
                    originalRequest.headers['Authorization'] = `Bearer ${token}`;
                    return api(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const response = await axios.post('/api/auth/refresh', {
                    refresh_token: refreshToken,
                });

                const { access_token, refresh_token: newRefreshToken } = response.data;

                localStorage.setItem('token', access_token);
                if (newRefreshToken) {
                    localStorage.setItem('refresh_token', newRefreshToken);
                }
                document.cookie = `token=${access_token}; path=/; max-age=900; SameSite=Lax`;

                api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                processQueue(null, access_token);

                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                clearAuthAndRedirect();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);
