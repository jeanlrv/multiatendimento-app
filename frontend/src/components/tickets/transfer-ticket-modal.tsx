'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRightLeft, Building2, User, RefreshCcw, Send } from 'lucide-react';
import { api } from '@/services/api';

interface TransferTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: string;
    onSuccess: () => void;
}

interface Department {
    id: string;
    name: string;
}

interface User {
    id: string;
    name: string;
    departmentId?: string;
}


export default function TransferTicketModal({ isOpen, onClose, ticketId, onSuccess }: TransferTicketModalProps) {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [selectedDept, setSelectedDept] = useState('');
    const [selectedUser, setSelectedUser] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async () => {
        const token = localStorage.getItem('token');
        try {
            const [deptRes, usersRes] = await Promise.all([
                api.get('/departments'),
                api.get('/users')
            ]);
            setDepartments(deptRes.data);
            setUsers(usersRes.data);
        } catch (error) {
            console.error('Erro ao buscar dados de transferência:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async () => {
        if (!selectedDept && !selectedUser) return;

        setSubmitting(true);
        const token = localStorage.getItem('token');
        try {
            await api.patch(`/tickets/${ticketId}`,
                {
                    departmentId: selectedDept || undefined,
                    assignedUserId: selectedUser || null // Se selecionado apenas depto, tira o usuário atual ou deixa pra auto-distribuição
                }
            );

            // Opcional: Enviar mensagem avisando (já planejado no service futuramente)

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Erro ao transferir ticket:', error);
            alert('Falha ao transferir ticket.');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredUsers = selectedDept
        ? users.filter(u => u.departmentId === selectedDept)
        : users;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-gray-950/80 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 relative z-10 border border-white/20 overflow-hidden"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                                <ArrowRightLeft className="text-blue-600" /> Transferir Chamado
                            </h3>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-all">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Departamento */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                    <Building2 size={12} /> Novo Departamento
                                </label>
                                <select
                                    value={selectedDept}
                                    onChange={e => {
                                        setSelectedDept(e.target.value);
                                        setSelectedUser(''); // Resetar usuário se mudar depto
                                    }}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-blue-500/50 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none transition-all dark:text-white appearance-none"
                                >
                                    <option value="">Não alterar departamento</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>{dept.name.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Usuário Agente */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                                    <User size={12} /> Novo Atendente (Opcional)
                                </label>
                                <select
                                    value={selectedUser}
                                    onChange={e => setSelectedUser(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-blue-500/50 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none transition-all dark:text-white appearance-none"
                                >
                                    <option value="">Auto-distribuição ou Fila</option>
                                    {filteredUsers.map(user => (
                                        <option key={user.id} value={user.id}>{user.name.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t border-gray-100 dark:border-white/5">
                            <button
                                onClick={handleTransfer}
                                disabled={submitting || (!selectedDept && !selectedUser)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:grayscale"
                            >
                                {submitting ? <RefreshCcw className="animate-spin" size={20} /> : <Send size={20} />}
                                <span className="tracking-widest">CONFIRMAR TRANSFERÊNCIA</span>
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
