'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutos
const WARNING_SECONDS = 60;            // aviso 60s antes do logout

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

export function SessionTimeoutGuard({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();
    const [showWarning, setShowWarning] = useState(false);
    const [countdown, setCountdown] = useState(WARNING_SECONDS);

    const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const showingWarningRef = useRef(false);

    const clearAllTimers = () => {
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
    };

    const startWarningCountdown = useCallback(() => {
        showingWarningRef.current = true;
        setShowWarning(true);
        setCountdown(WARNING_SECONDS);

        let count = WARNING_SECONDS;
        countdownRef.current = setInterval(() => {
            count -= 1;
            setCountdown(count);
            if (count <= 0) {
                clearInterval(countdownRef.current!);
                showingWarningRef.current = false;
                logout();
            }
        }, 1000);
    }, [logout]);

    const resetInactivityTimer = useCallback(() => {
        if (showingWarningRef.current) return; // não reinicia se aviso está ativo

        clearAllTimers();
        warningTimerRef.current = setTimeout(() => {
            startWarningCountdown();
        }, INACTIVITY_MS - WARNING_SECONDS * 1000);
    }, [startWarningCountdown]);

    useEffect(() => {
        if (!user) return;

        const handler = () => resetInactivityTimer();
        ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, handler, { passive: true }));
        resetInactivityTimer();

        return () => {
            ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, handler));
            clearAllTimers();
        };
    }, [user, resetInactivityTimer]);

    const handleContinue = async () => {
        try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                const resp = await api.post('/auth/refresh', { refresh_token: refreshToken });
                const { access_token, refresh_token: newRT } = resp.data;
                localStorage.setItem('token', access_token);
                if (newRT) localStorage.setItem('refresh_token', newRT);
                document.cookie = `token=${access_token}; path=/; max-age=900; SameSite=Lax`;
            }
        } catch {
            // se falhar, faz logout mesmo assim
            logout();
            return;
        }
        // Limpar e reiniciar timer
        showingWarningRef.current = false;
        setShowWarning(false);
        setCountdown(WARNING_SECONDS);
        clearAllTimers();
        resetInactivityTimer();
    };

    const handleLogout = () => {
        clearAllTimers();
        showingWarningRef.current = false;
        setShowWarning(false);
        logout();
    };

    return (
        <>
            {children}

            {showWarning && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-10 max-w-sm w-full mx-4 shadow-2xl border border-slate-100 dark:border-white/10 text-center space-y-6">
                        {/* Ícone animado */}
                        <div className="relative w-24 h-24 mx-auto">
                            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-white/10" />
                                <circle
                                    cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="8"
                                    strokeDasharray={`${2 * Math.PI * 44}`}
                                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - countdown / WARNING_SECONDS)}`}
                                    strokeLinecap="round"
                                    className="text-amber-500 transition-all duration-1000"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                                    {countdown}
                                </span>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                                Sessão expirando
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                Por inatividade, você será desconectado automaticamente. Deseja continuar?
                            </p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleContinue}
                                className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                Continuar sessão
                            </button>
                            <button
                                onClick={handleLogout}
                                className="w-full py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-400 font-bold text-sm hover:text-rose-500 hover:border-rose-200 transition-all"
                            >
                                Sair agora
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
