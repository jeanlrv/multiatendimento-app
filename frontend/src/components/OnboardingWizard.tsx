'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Smartphone, Building2, Users, CheckCircle2,
    ArrowRight, ArrowLeft, X, Sparkles, ExternalLink
} from 'lucide-react';
import { api } from '@/services/api';
import { useRouter } from 'next/navigation';

const ONBOARDING_KEY = 'kszap_onboarding_done';

interface Step {
    id: number;
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: string;
    href?: string;
    check: () => Promise<boolean>;
}

interface OnboardingWizardProps {
    onClose: () => void;
}

export function OnboardingWizard({ onClose }: OnboardingWizardProps) {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [checking, setChecking] = useState(false);

    const steps: Step[] = [
        {
            id: 0,
            icon: <Smartphone className="w-8 h-8 text-green-400" />,
            title: 'Conectar WhatsApp',
            description: 'Adicione sua primeira conexão WhatsApp para começar a atender clientes. Você precisará escanear um QR Code.',
            action: 'Configurar WhatsApp',
            href: '/dashboard/whatsapp',
            check: async () => {
                const res = await api.get('/whatsapp');
                return Array.isArray(res.data) && res.data.length > 0;
            },
        },
        {
            id: 1,
            icon: <Building2 className="w-8 h-8 text-blue-400" />,
            title: 'Criar Departamento',
            description: 'Organize sua equipe em departamentos (ex: Suporte, Vendas, Financeiro) para distribuir atendimentos.',
            action: 'Criar Departamento',
            href: '/dashboard/departments',
            check: async () => {
                const res = await api.get('/departments');
                return Array.isArray(res.data) && res.data.length > 0;
            },
        },
        {
            id: 2,
            icon: <Users className="w-8 h-8 text-violet-400" />,
            title: 'Adicionar Agentes',
            description: 'Convide sua equipe. Agentes receberão tickets automaticamente conforme a fila de distribuição.',
            action: 'Gerenciar Usuários',
            href: '/dashboard/users',
            check: async () => {
                const res = await api.get('/users');
                const users = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
                // Considera concluído se há mais de 1 usuário (além do próprio admin)
                return users.length > 1;
            },
        },
        {
            id: 3,
            icon: <CheckCircle2 className="w-8 h-8 text-emerald-400" />,
            title: 'Tudo pronto!',
            description: 'Sua conta está configurada. Agora você pode começar a atender clientes via WhatsApp com IA e automações.',
            check: async () => true,
        },
    ];

    // Verificar quais passos já estão concluídos ao abrir
    useEffect(() => {
        const checkAll = async () => {
            const done = new Set<number>();
            for (const step of steps.slice(0, 3)) {
                try {
                    const ok = await step.check();
                    if (ok) done.add(step.id);
                } catch { /* ignorar falhas de verificação */ }
            }
            setCompletedSteps(done);
            // Avançar para o primeiro passo não concluído
            const firstPending = steps.findIndex(s => s.id < 3 && !done.has(s.id));
            if (firstPending !== -1) setCurrentStep(firstPending);
            else setCurrentStep(3); // todos prontos
        };
        checkAll();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCheckStep = async () => {
        setChecking(true);
        try {
            const ok = await steps[currentStep].check();
            if (ok) {
                setCompletedSteps(prev => new Set([...prev, currentStep]));
                setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
            }
        } catch { /* ignorar */ } finally {
            setChecking(false);
        }
    };

    const handleFinish = () => {
        localStorage.setItem(ONBOARDING_KEY, '1');
        onClose();
    };

    const step = steps[currentStep];
    const progress = Math.round((completedSteps.size / 3) * 100);

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 20 }}
                transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-white/10 overflow-hidden"
            >
                {/* Header */}
                <div className="relative p-6 pb-0 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Configuração Inicial</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">
                            Bem-vindo ao KSZap!
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Siga os passos abaixo para configurar seu ambiente em minutos.
                        </p>
                    </div>
                    <button
                        onClick={handleFinish}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                        title="Fechar e configurar depois"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Progress bar */}
                <div className="px-6 pt-4">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                        <span>Progresso</span>
                        <span>{completedSteps.size}/3 passos</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>

                {/* Steps indicator */}
                <div className="flex items-center gap-2 px-6 pt-4">
                    {steps.map((s, i) => (
                        <button
                            key={s.id}
                            onClick={() => i < 3 && setCurrentStep(i)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all
                                ${currentStep === i
                                    ? 'bg-primary/10 text-primary'
                                    : completedSteps.has(i)
                                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                        : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                                }`}
                        >
                            {completedSteps.has(i) ? (
                                <CheckCircle2 size={12} className="text-emerald-500" />
                            ) : (
                                <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[9px]">
                                    {i + 1}
                                </span>
                            )}
                            <span className="hidden sm:block">
                                {i === 0 ? 'WhatsApp' : i === 1 ? 'Dept.' : i === 2 ? 'Agentes' : 'Pronto'}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Step content */}
                <div className="p-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-4"
                        >
                            <div className={`flex items-center gap-4 p-4 rounded-2xl border
                                ${currentStep === 3
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'
                                }`}
                            >
                                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow flex items-center justify-center flex-shrink-0">
                                    {step.icon}
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-base">
                                        {step.title}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                        {step.description}
                                    </p>
                                </div>
                            </div>

                            {currentStep < 3 && (
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3">
                                    <span className="text-amber-500">💡</span>
                                    <span>
                                        {currentStep === 0 && 'Você pode conectar múltiplos números WhatsApp depois.'}
                                        {currentStep === 1 && 'Configure horários e SLA por departamento nas configurações.'}
                                        {currentStep === 2 && 'Defina permissões granulares por função (admin, agente, supervisor).'}
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer actions */}
                <div className="px-6 pb-6 flex items-center gap-3">
                    {currentStep > 0 && currentStep < 3 && (
                        <button
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            className="p-3 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                        >
                            <ArrowLeft size={16} />
                        </button>
                    )}

                    {currentStep < 3 && step.href && (
                        <button
                            onClick={() => {
                                router.push(step.href!);
                                onClose();
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                        >
                            <ExternalLink size={14} />
                            {step.action}
                        </button>
                    )}

                    {currentStep < 3 ? (
                        <button
                            onClick={handleCheckStep}
                            disabled={checking}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
                        >
                            {checking ? (
                                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                            ) : (
                                <>
                                    Já configurei
                                    <ArrowRight size={14} />
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleFinish}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            <CheckCircle2 size={16} />
                            Começar a atender
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

/** Hook para controlar visibilidade do wizard */
export function useOnboarding() {
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        const done = localStorage.getItem(ONBOARDING_KEY);
        if (!done) {
            // Pequeno delay para não bloquear o carregamento inicial
            const t = setTimeout(() => setShowWizard(true), 1500);
            return () => clearTimeout(t);
        }
    }, []);

    return { showWizard, setShowWizard };
}
