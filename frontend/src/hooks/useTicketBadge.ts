'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/services/api';
import { getSocket } from '@/lib/socket';

const POLL_INTERVAL = 60_000; // 60s fallback (reduzido por ter WebSocket)

/**
 * Retorna a contagem de tickets abertos nos departamentos acessíveis ao usuário.
 * Inclui tickets não atribuídos em modo HUMANO aguardando atendente.
 * Atualiza em tempo real via WebSocket com fallback de polling a cada 60s.
 */
export function useTicketBadge(userId?: string) {
    const [count, setCount] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchCount = async () => {
        if (!userId) return;
        try {
            // Sem assignedUserId: backend escopar por departamentos do usuário (não-admins)
            // ou retorna todos (admins). Assim tickets não atribuídos no depto também contam.
            const resp = await api.get('/tickets', {
                params: { status: 'OPEN', page: 1, limit: 1 },
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
        const handleTicketCreated = () => fetchCount();
        const handleTicketUpdated = () => fetchCount();
        const handleTicketTransferred = () => fetchCount();
        // Quando IA transfere para humano, incrementa imediatamente sem aguardar poll
        const handleTicketHumanQueue = () => fetchCount();

        const socket = getSocket(null);
        socket.on('ticketCreated', handleTicketCreated);
        socket.on('ticketUpdated', handleTicketUpdated);
        socket.on('ticketTransferred', handleTicketTransferred);
        socket.on('ticketHumanQueue', handleTicketHumanQueue);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            window.removeEventListener('focus', onFocus);
            socket.off('ticketCreated', handleTicketCreated);
            socket.off('ticketUpdated', handleTicketUpdated);
            socket.off('ticketTransferred', handleTicketTransferred);
            socket.off('ticketHumanQueue', handleTicketHumanQueue);
        };
    }, [userId]);

    return count;
}
