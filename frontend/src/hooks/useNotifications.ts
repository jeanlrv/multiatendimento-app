'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsService, Notification } from '@/services/notifications';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const { token } = useAuth();
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    const loadNotifications = useCallback(async () => {
        if (!token) return;
        try {
            const data = await notificationsService.findUnread();
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.readAt).length);
        } catch {
            // falha silenciosa (não bloquear UI)
        } finally {
            setLoading(false);
        }
    }, [token]);

    const markRead = useCallback(async (ids: string[]) => {
        await notificationsService.markRead(ids);
        setNotifications(prev =>
            prev.map(n => ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - ids.length));
    }, []);

    const markAllRead = useCallback(async () => {
        await notificationsService.markAllRead();
        setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
        setUnreadCount(0);
    }, []);

    // Polling a cada 60s como fallback
    useEffect(() => {
        if (!token) return;
        loadNotifications();
        pollingRef.current = setInterval(loadNotifications, 60_000);
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [token, loadNotifications]);

    // Socket.io: push em tempo real
    useEffect(() => {
        if (!token) return;
        const socket = getSocket(token, 'chat');

        const handler = (notification: Notification) => {
            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
            toast(notification.title, {
                description: notification.body,
                duration: 5000,
            });
        };

        socket.on('notification', handler);
        return () => {
            socket.off('notification', handler);
        };
    }, [token]);

    return {
        notifications,
        unreadCount,
        loading,
        markRead,
        markAllRead,
        reload: loadNotifications,
    };
}
