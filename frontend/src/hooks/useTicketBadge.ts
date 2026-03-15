'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/services/api';
import { getSocket } from '@/lib/socket';

const POLL_INTERVAL = 60_000; // 60s fallback (reduzido por ter WebSocket)

/**
 * Retorna a contagem de tickets abertos/em andamento atribuídos ao usuário atual.
 * Atualiza em tempo real via WebSocket (ticketCreated, ticketUpdated, ticketTransferred)
 * com fallback de polling a cada 60s.
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

        // WebSocket: escutar eventos de ticket em tempo real.
        // O socket usa withCredentials: true, então autentica via httpOnly cookie.
        // Não depende de localStorage.
        const handleTicketCreated = () => fetchCount();
        const handleTicketUpdated = () => fetchCount();
        const handleTicketTransferred = () => fetchCount();

        const socket = getSocket(null);
        socket.on('ticketCreated', handleTicketCreated);
        socket.on('ticketUpdated', handleTicketUpdated);
        socket.on('ticketTransferred', handleTicketTransferred);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            window.removeEventListener('focus', onFocus);
            socket.off('ticketCreated', handleTicketCreated);
            socket.off('ticketUpdated', handleTicketUpdated);
            socket.off('ticketTransferred', handleTicketTransferred);
        };
    }, [userId]);

    return count;
}
