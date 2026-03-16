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
        }, 10000);
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

        const elapsedMs = endTimeMs - startTimeMs;
        const percent = (elapsedMs / limitMs) * 100;

        const isBreached = percent >= 100;
        const isWarning75 = !isBreached && percent >= 75 && percent < 90;
        const isWarning90 = !isBreached && percent >= 90;

        // Diferença em minutos (para mostrar no UI de quanto passou ou quanto falta)
        const diffInMinutes = Math.abs(Math.floor((targetTimeMs - endTimeMs) / 60000));

        return {
            isBreached,
            isWarning75,
            isWarning90,
            percent,
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
    const activeSla = (responseSla && !responseSla.isCompleted) ? responseSla :
                      (resolutionSla && !resolutionSla.isCompleted) ? resolutionSla :
                      responseSla?.isBreached ? responseSla :
                      resolutionSla?.isBreached ? resolutionSla : null;

    const label = activeSla === responseSla ? (responseSla?.isBreached ? '1ª Resposta Atrasada' : '1ª Resposta') :
                  activeSla === resolutionSla ? (resolutionSla?.isBreached ? 'Resolução Atrasada' : 'Resolução') : '';

    if (!activeSla) {
        // Tudo Cumprido dentro do prazo (Opcional mostrar verdinho)
        return (
            <div className="flex items-center gap-1 text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20 mt-1.5 opacity-60">
                <CheckCircle2 size={8} />
                <span className="text-[8px] font-black uppercase tracking-widest">SLA OK</span>
            </div>
        );
    }

    if (activeSla.isBreached && !activeSla.isCompleted) {
        return (
            <motion.div
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ repeat: Infinity, duration: 1, repeatType: "reverse" }}
                className="flex items-center gap-1 text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded-md border border-rose-400 dark:border-rose-500/40 mt-1.5 w-max shadow-sm shadow-rose-500/20"
            >
                <AlertTriangle size={10} />
                <span className="text-[8px] font-black tracking-widest uppercase truncate max-w-[120px]">
                    SLA {label} ({activeSla.minutesDiff}m atraso)
                </span>
            </motion.div>
        );
    }

    if (activeSla.isWarning90 && !activeSla.isCompleted) {
        return (
            <motion.div
                initial={{ scale: 0.98 }}
                animate={{ scale: 1.02 }}
                transition={{ repeat: Infinity, duration: 1.5, repeatType: "reverse" }}
                className="flex items-center gap-1 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 rounded-md border border-orange-400 dark:border-orange-500/40 mt-1.5 w-max"
            >
                <AlertTriangle size={10} />
                <span className="text-[8px] font-black tracking-widest uppercase truncate max-w-[120px]">
                    {label}: {activeSla.minutesDiff}m (Crítico)
                </span>
            </motion.div>
        );
    }

    if (activeSla.isWarning75 && !activeSla.isCompleted) {
        return (
            <div className="flex items-center gap-1 text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-300 dark:border-amber-500/30 mt-1.5 w-max">
                <Clock size={10} />
                <span className="text-[8px] font-black tracking-widest uppercase truncate max-w-[120px]">
                    {label}: {activeSla.minutesDiff}m (Alerta)
                </span>
            </div>
        );
    }

    // SLA está rolando mas está safe
    if (!activeSla.isCompleted) {
        return (
            <div className="flex items-center gap-1 text-slate-500 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-white/10 mt-1.5 w-max opacity-80">
                <Clock size={8} />
                <span className="text-[8px] font-black tracking-widest uppercase">
                    {label}: {activeSla.minutesDiff}m
                </span>
            </div>
        );
    }

    return null;
}
