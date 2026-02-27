'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';

interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string | null;
    role: string;
    permissions?: string[];   // permissões DB-driven do perfil de acesso
    companyId?: string;
    departments: { id: string, name: string }[];
}

interface Company {
    id: string;
    name: string;
    logoUrl?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
}

interface AuthContextType {
    user: User | null;
    company: Company | null;
    loading: boolean;
    login: (email: string, pass: string) => Promise<void>;
    logout: () => void;
    updateUser: (userData: Partial<User>) => void;
    updateCompany: (companyData: Partial<Company>) => void;
    isAuthenticated: boolean;
    token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        const storedCompany = localStorage.getItem('company');

        if (storedToken && storedUser) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
                if (storedCompany) {
                    setCompany(JSON.parse(storedCompany));
                }
            } catch (e) {
                console.error('Error parsing stored user:', e);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                localStorage.removeItem('company');
            }
        }
        setLoading(false);
    }, []);

    const fetchCompany = async () => {
        try {
            const response = await api.get('/companies/me');
            const companyData = response.data;
            setCompany(companyData);
            localStorage.setItem('company', JSON.stringify(companyData));
            return companyData;
        } catch (e) {
            console.error('Erro ao carregar empresa:', e);
        }
    };

    const login = async (email: string, pass: string) => {
        try {
            const response = await api.post('/auth/login', { email, password: pass });
            const { access_token, refresh_token, user: userData } = response.data;

            localStorage.setItem('token', access_token);
            if (refresh_token) {
                localStorage.setItem('refresh_token', refresh_token);
            }
            localStorage.setItem('user', JSON.stringify(userData));
            setToken(access_token);

            // Set cookie for middleware
            document.cookie = `token=${access_token}; path=/; max-age=900; SameSite=Lax`;

            setUser(userData);

            // Fetch company branding e redirecionar sequencialmente
            await fetchCompany();
            router.push('/dashboard');
        } catch (error: any) {
            // Logar apenas status HTTP — nunca dados de resposta (podem conter informações sensíveis)
            const status = error.response?.status;
            console.error('Erro no login:', { status });
            throw error;
        }
    };

    const logout = () => {
        // Invalidar refresh token no servidor (fire-and-forget)
        const storedRefreshToken = localStorage.getItem('refresh_token');
        if (storedRefreshToken) {
            api.post('/auth/logout', { refresh_token: storedRefreshToken }).catch(() => { });
        }

        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('company');
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

        // Disconnect all sockets
        import('@/lib/socket').then(({ disconnectAllSockets }) => {
            disconnectAllSockets();
        });

        setUser(null);
        setCompany(null);
        setToken(null);
        router.push('/login');
    };

    const updateUser = (userData: Partial<User>) => {
        setUser((prev) => {
            if (!prev) return null;
            const updated = { ...prev, ...userData };
            localStorage.setItem('user', JSON.stringify(updated));
            return updated;
        });
    };

    const updateCompany = (companyData: Partial<Company>) => {
        setCompany((prev) => {
            const updated = { ...(prev || { id: '', name: '' }), ...companyData };
            localStorage.setItem('company', JSON.stringify(updated));
            return updated as Company;
        });
    };

    return (
        <AuthContext.Provider value={{ user, company, loading, login, logout, updateUser, updateCompany, isAuthenticated: !!user, token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};
