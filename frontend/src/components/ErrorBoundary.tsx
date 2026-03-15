'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Captura para Sentry em produção
        if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
            import('@sentry/nextjs').then(({ captureException }) => {
                captureException(error, { extra: { componentStack: info.componentStack } });
            }).catch(() => { });
        }
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
                    <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            Algo deu errado
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                            Ocorreu um erro inesperado nesta página. Tente recarregar ou volte mais tarde.
                        </p>
                        {process.env.NODE_ENV !== 'production' && this.state.error && (
                            <pre className="mt-3 text-xs text-left bg-slate-100 dark:bg-slate-800 rounded p-3 max-w-lg overflow-auto">
                                {this.state.error.message}
                            </pre>
                        )}
                    </div>
                    <button
                        onClick={this.handleReset}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Recarregar página
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
