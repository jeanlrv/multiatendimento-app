'use client';

import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface TicketWithSla {
    createdAt: string;
    firstResponseAt?: string | null;
    resolvedAt?: string | null;
    status: string;
    department: {
        slaFirstResponseMin?: number | null;
        slaResolutionMin?: number | null;
    };
}

export function SlaIndicator({ ticket }: { ticket: TicketWithSla }) {
    const [now, setNow] = useState(new Date());

    // Update current time every minute to refresh SLA timers if ticket is open
    useEffect(() => {
        if (ticket.status === 'RESOLVED' || ticket.status === 'CANCELLED') return;

        const interval = setInterval(() => {
            setNow(new Date());
        }, 60000);
        return () => clearInterval(interval);
    }, [ticket.status]);

    const calculateSLA = (
        startTimeMs: number,
        limitMinutes: number | undefined | null,
        endTimeStr: string | null | undefined
    ) => {
        if (!limitMinutes) return null;

        const limitMs = limitMinutes * 60 * 1000;
        const targetTimeMs = startTimeMs + limitMs;
        const endTimeMs = endTimeStr ? new Date(endTimeStr).getTime() : now.getTime();

        const isBreached = endTimeMs > targetTimeMs;
        const isWarning = !isBreached && (targetTimeMs - endTimeMs) <= (limitMs * 0.2); // 20% do tempo restante alerta

        // Diferença em minutos (para mostrar no UI de quanto passou ou quanto falta)
        const diffInMinutes = Math.abs(Math.floor((targetTimeMs - endTimeMs) / 60000));

        return {
            isBreached,
            isWarning,
            isCompleted: !!endTimeStr,
            minutesDiff: diffInMinutes
        };
    };

    const createdTimeMs = new Date(ticket.createdAt).getTime();

    const responseSla = calculateSLA(createdTimeMs, ticket.department.slaFirstResponseMin, ticket.firstResponseAt);
    const resolutionSla = calculateSLA(createdTimeMs, ticket.department.slaResolutionMin, ticket.resolvedAt);

    // Se não há SLA nenhum, nem renderiza
    if (!responseSla && !resolutionSla) return null;

    // Priorizamos exibir o que está pior/pendente.
    // 1. Se SLA Resposta estiver quebrado e não foi respondido ainda.
    // 2. Ou SLA Resolução quebrado.

    let activeSla = null;
    let label = '';

    if (responseSla && !responseSla.isCompleted) {
        activeSla = responseSla;
        label = '1ª Resposta';
    } else if (resolutionSla && !resolutionSla.isCompleted) {
        activeSla = resolutionSla;
        label = 'Resolução';
    } else if (responseSla?.isBreached) {
        // Já foi cumprido, mas em com quebra
        activeSla = responseSla;
        label = '1ª Resposta Atrasada';
    } else if (resolutionSla?.isBreached) {
        activeSla = resolutionSla;
        label = 'Resolução Atrasada';
    } else {
        // Tudo Cumprido dentro do prazo (Opcional mostrar verdinho)
        return (
            <div className="flex items-center gap-1 text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20 shadow-sm mt-2 opacity-60">
                <CheckCircle2 size={10} />
                <span className="text-[9px] font-black uppercase tracking-widest">SLA OK</span>
            </div>
        );
    }

    if (!activeSla) return null;

    if (activeSla.isBreached && !activeSla.isCompleted) {
        return (
            <motion.div
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ repeat: Infinity, duration: 2, repeatType: "reverse" }}
                className="flex items-center gap-1.5 text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-500/30 shadow-md mt-2 w-max"
            >
                <AlertTriangle size={12} className="animate-pulse" />
                <span className="text-[10px] font-black tracking-widest uppercase">
                    SLA {label} Quebrado ({activeSla.minutesDiff}m atraso)
                </span>
            </motion.div>
        );
    }

    if (activeSla.isWarning && !activeSla.isCompleted) {
        return (
            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-500/30 shadow-sm mt-2 w-max">
                <Clock size={12} />
                <span className="text-[10px] font-black tracking-widest uppercase">
                    Atenção {label}: {activeSla.minutesDiff}m restam
                </span>
            </div>
        );
    }

    // SLA está rolando mas está safe
    if (!activeSla.isCompleted) {
        return (
            <div className="flex items-center gap-1.5 text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-white/10 mt-2 w-max opacity-80">
                <Clock size={10} />
                <span className="text-[9px] font-black tracking-widest uppercase">
                    Alvo {label}: {activeSla.minutesDiff}m
                </span>
            </div>
        );
    }

    return null;
}
