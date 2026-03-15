'use client';

import { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'cookieConsent';

type ConsentChoice = 'accepted' | 'rejected' | null;

export function CookieConsent() {
    const [choice, setChoice] = useState<ConsentChoice | 'loading'>('loading');

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY) as ConsentChoice | null;
        setChoice(stored);
    }, []);

    const handleAccept = () => {
        localStorage.setItem(STORAGE_KEY, 'accepted');
        setChoice('accepted');
    };

    const handleReject = () => {
        localStorage.setItem(STORAGE_KEY, 'rejected');
        setChoice('rejected');
        // Desativar Sentry analytics se rejeitado
        if (typeof window !== 'undefined' && (window as any).__SENTRY__) {
            try {
                import('@sentry/nextjs').then(({ getClient }) => {
                    const client = getClient();
                    client?.getOptions?.() && (client.getOptions().enabled = false);
                }).catch(() => { });
            } catch { }
        }
    };

    // Não mostrar até carregar ou se já escolheu
    if (choice === 'loading' || choice !== null) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[9999] animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-5">
                <div className="flex items-start gap-3 mb-4">
                    <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2 flex-shrink-0">
                        <Cookie className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Cookies & Privacidade
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Usamos cookies essenciais para funcionamento da plataforma e cookies analíticos (Sentry) para monitorar erros.
                            Conforme a LGPD, você pode rejeitar os não essenciais.
                        </p>
                    </div>
                    <button
                        onClick={handleReject}
                        className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        aria-label="Fechar"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleReject}
                        className="flex-1 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Apenas essenciais
                    </button>
                    <button
                        onClick={handleAccept}
                        className="flex-1 px-3 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                    >
                        Aceitar todos
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Hook para verificar consentimento antes de ativar analytics */
export function useCookieConsent(): ConsentChoice {
    const [consent, setConsent] = useState<ConsentChoice>(null);
    useEffect(() => {
        setConsent(localStorage.getItem(STORAGE_KEY) as ConsentChoice | null);
    }, []);
    return consent;
}
