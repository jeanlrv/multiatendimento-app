'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/services/api';

const POLL_INTERVAL = 30_000; // 30 segundos

/**
 * Retorna a contagem de tickets abertos/em andamento atribuídos ao usuário atual.
 * Atualiza a cada 30s via polling e também quando a aba volta ao foco.
 */
export function useTicketBadge(userId?: string) {
    const [count, setCount] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchCount = async () => {
        if (!userId) return;
        try {
            const resp = await api.get('/tickets', {
                params: { status: 'OPEN', assignedUserId: userId, page: 1, limit: 1 },
            });
            const total: number =
                resp.data?.meta?.total ??
                resp.data?.total ??
                (Array.isArray(resp.data) ? resp.data.length : 0);
            setCount(total);
        } catch {
            // silencioso — não quebra a UI se falhar
        }
    };

    useEffect(() => {
        if (!userId) return;

        fetchCount();
        intervalRef.current = setInterval(fetchCount, POLL_INTERVAL);

        // Atualiza também quando o usuário volta à aba
        const onFocus = () => fetchCount();
        window.addEventListener('focus', onFocus);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            window.removeEventListener('focus', onFocus);
        };
    }, [userId]);

    return count;
}
