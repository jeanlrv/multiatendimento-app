'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useCollaboration } from '@/hooks/useCollaboration';
import { Users, Search, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserPresence {
    id: string;
    name: string;
    avatar?: string | null;
    email: string;
    presence: {
        status: 'ONLINE' | 'OFFLINE' | 'BUSY';
        lastSeen: string;
    };
}

interface PresenceSidebarProps {
    onSelectUser: (userId: string) => void;
}

export const PresenceSidebar: React.FC<PresenceSidebarProps> = ({ onSelectUser }) => {
    const [users, setUsers] = useState<UserPresence[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const { presence, openDirectChat } = useCollaboration();

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await api.get('/collaboration/users');
                setUsers(res.data);
            } catch (error) {
                console.error('Erro ao buscar usuários:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    ).map(u => ({
        ...u,
        currentStatus: presence[u.id] || u.presence.status
    })).sort((a, b) => {
        if (a.currentStatus === 'ONLINE' && b.currentStatus !== 'ONLINE') return -1;
        if (a.currentStatus !== 'ONLINE' && b.currentStatus === 'ONLINE') return 1;
        return a.name.localeCompare(b.name);
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ONLINE': return 'text-green-500';
            case 'BUSY': return 'text-amber-500';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="w-72 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-white/10 flex flex-col h-full">
            <div className="p-4 border-b border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-primary" />
                    <h2 className="font-black uppercase tracking-widest text-sm text-gray-900 dark:text-white">Colaboradores</h2>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-white/5 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {loading ? (
                    <div className="flex flex-col gap-2 p-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-12 w-full bg-gray-100 dark:bg-white/5 animate-pulse rounded-xl" />
                        ))}
                    </div>
                ) : (
                    <AnimatePresence>
                        {filteredUsers.map(u => (
                            <motion.button
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                key={u.id}
                                onClick={() => openDirectChat(u.id)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-all group relative"
                            >
                                <div className="relative">
                                    {u.avatar ? (
                                        <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                            {u.name.charAt(0)}
                                        </div>
                                    )}
                                    <div className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-white dark:bg-slate-900 rounded-full">
                                        <Circle className={`w-3 h-3 fill-current ${getStatusColor(u.currentStatus)}`} />
                                    </div>
                                </div>
                                <div className="flex-1 text-left overflow-hidden">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate group-hover:text-primary transition-colors">
                                        {u.name}
                                    </p>
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-tighter opacity-60">
                                        {u.currentStatus}
                                    </p>
                                </div>
                            </motion.button>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};
