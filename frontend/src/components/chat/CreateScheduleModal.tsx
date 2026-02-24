'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Clock, AlignLeft } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface CreateScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    contactId: string;
    contactName: string;
    departmentId?: string;
    onSuccess: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export function CreateScheduleModal({
    isOpen,
    onClose,
    contactId,
    contactName,
    departmentId,
    onSuccess
}: CreateScheduleModalProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        startTime: '',
        endTime: '',
        notes: ''
    });

    useEffect(() => {
        if (isOpen) {
            // Pre-fill with next hour
            const now = new Date();
            now.setMinutes(0, 0, 0);
            now.setHours(now.getHours() + 1);

            const start = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

            now.setHours(now.getHours() + 1);
            const end = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

            setForm({
                startTime: start,
                endTime: end,
                notes: ''
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/scheduling`, {
                contactId,
                userId: user?.id,
                departmentId: departmentId || user?.departments?.[0]?.id,
                startTime: new Date(form.startTime).toISOString(),
                endTime: new Date(form.endTime).toISOString(),
                notes: form.notes
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            toast.success('Agendamento criado com sucesso!');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Erro ao criar agendamento:', error);
            toast.error(error.response?.data?.message || 'Erro ao criar agendamento. Verifique horários.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl relative z-10 border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 text-emerald-600 rounded-xl">
                            <CalendarIcon size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Novo Agendamento</h2>
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{contactName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">

                    <div className="space-y-4">
                        <div>
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">
                                <Clock size={12} /> Início
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={form.startTime}
                                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                                className="w-full bg-slate-100 dark:bg-white/5 border border-transparent dark:border-white/10 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white focus:border-primary outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">
                                <Clock size={12} /> Fim
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={form.endTime}
                                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                                className="w-full bg-slate-100 dark:bg-white/5 border border-transparent dark:border-white/10 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white focus:border-primary outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">
                                <AlignLeft size={12} /> Observações
                            </label>
                            <textarea
                                value={form.notes}
                                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="Detalhes do compromisso..."
                                className="w-full bg-slate-100 dark:bg-white/5 border border-transparent dark:border-white/10 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white focus:border-primary outline-none transition-all min-h-[100px] resize-none"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50"
                        >
                            {loading ? 'Salvando...' : 'Agendar'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
