"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBr from "@fullcalendar/core/locales/pt-br";
import { api } from "@/services/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
    Calendar, Plus, X, CheckCircle2, XCircle, Clock,
    User, Building2, AlarmClock, FileText, ChevronRight,
    Pencil, Trash2, AlertCircle
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ScheduleStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "NO_SHOW";

const STATUS_CONFIG: Record<ScheduleStatus, { label: string; color: string; bg: string; dot: string }> = {
    PENDING: { label: "Pendente", color: "text-blue-600", bg: "bg-blue-500/10 border-blue-500/20", dot: "bg-blue-500" },
    CONFIRMED: { label: "Confirmado", color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-500" },
    CANCELLED: { label: "Cancelado", color: "text-red-600", bg: "bg-red-500/10 border-red-500/20", dot: "bg-red-500" },
    NO_SHOW: { label: "Não Compareceu", color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/20", dot: "bg-amber-500" },
};

const CAL_COLORS: Record<ScheduleStatus, string> = {
    CONFIRMED: "rgba(16,185,129,0.7)",
    CANCELLED: "rgba(239,68,68,0.6)",
    NO_SHOW: "rgba(245,158,11,0.7)",
    PENDING: "rgba(59,130,246,0.7)",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SchedulingPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [rawSchedules, setRawSchedules] = useState<any[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [filters, setFilters] = useState({ userId: "", departmentId: "" });

    const initialForm = { contactId: "", userId: "", departmentId: "", startTime: "", endTime: "", notes: "" };
    const [form, setForm] = useState(initialForm);

    // Aux data
    useEffect(() => {
        Promise.allSettled([api.get('/users'), api.get('/departments')]).then(([u, d]) => {
            if (u.status === 'fulfilled') setUsers(u.value.data);
            if (d.status === 'fulfilled') setDepartments(d.value.data);
        });
    }, []);

    const searchContacts = async (search: string) => {
        if (!search) return;
        const res = await api.get('/contacts', { params: { search } });
        setContacts(res.data);
    };

    // Fetch
    const fetchSchedules = async () => {
        try {
            setFetching(true);
            const res = await api.get('/scheduling', {
                params: {
                    userId: filters.userId || undefined,
                    departmentId: filters.departmentId || undefined,
                },
            });
            setRawSchedules(res.data);
            setEvents(res.data.map((s: any) => ({
                id: s.id,
                title: `${s.contact?.name || "Cliente"}`,
                start: s.startTime,
                end: s.endTime,
                backgroundColor: CAL_COLORS[s.status as ScheduleStatus] || CAL_COLORS.PENDING,
                borderColor: "transparent",
                textColor: "#fff",
                extendedProps: { status: s.status, raw: s },
            })));
        } catch {
            toast.error("Erro ao carregar agendamentos");
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => { fetchSchedules(); }, [filters]);

    // Stats
    const stats = useMemo(() => ({
        total: rawSchedules.length,
        confirmed: rawSchedules.filter(e => e.status === "CONFIRMED").length,
        cancelled: rawSchedules.filter(e => e.status === "CANCELLED").length,
        pending: rawSchedules.filter(e => e.status === "PENDING").length,
    }), [rawSchedules]);

    // Upcoming — próximos 5 a partir de agora
    const upcoming = useMemo(() =>
        rawSchedules
            .filter(s => new Date(s.startTime) > new Date() && s.status !== "CANCELLED")
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            .slice(0, 6),
        [rawSchedules]
    );

    // CRUD
    const handleSave = async () => {
        try {
            setLoading(true);
            if (editingId) {
                await api.patch(`/scheduling/${editingId}/time`, { startTime: form.startTime, endTime: form.endTime });
            } else {
                await api.post('/scheduling', form);
            }
            closeModal();
            fetchSchedules();
            toast.success(editingId ? "Agendamento atualizado!" : "Agendamento criado!");
        } catch (err: any) {
            const msg = err.response?.data?.message || "Erro ao salvar";
            toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: string, status: string) => {
        try {
            await api.patch(`/scheduling/${id}/status`, { status });
            setSelectedEvent(null);
            fetchSchedules();
            toast.success("Status atualizado!");
        } catch {
            toast.error("Erro ao atualizar status");
        }
    };

    const deleteSchedule = async (id: string) => {
        try {
            await api.delete(`/scheduling/${id}`);
            setSelectedEvent(null);
            fetchSchedules();
            toast.success("Agendamento excluído");
        } catch {
            toast.error("Erro ao excluir agendamento");
        }
    };

    const openEditFromDrawer = () => {
        if (!selectedEvent) return;
        setForm({
            contactId: selectedEvent.contactId || "",
            userId: selectedEvent.userId || "",
            departmentId: selectedEvent.departmentId || "",
            startTime: selectedEvent.startTime.slice(0, 16),
            endTime: selectedEvent.endTime.slice(0, 16),
            notes: selectedEvent.notes || "",
        });
        setEditingId(selectedEvent.id);
        setSelectedEvent(null);
        setShowModal(true);
    };

    const handleSelect = (info: any) => {
        setForm({ ...initialForm, startTime: info.startStr, endTime: info.endStr });
        setEditingId(null);
        setShowModal(true);
    };

    const handleEventDrop = async (info: any) => {
        try {
            await api.patch(`/scheduling/${info.event.id}/time`, {
                startTime: info.event.start,
                endTime: info.event.end,
            });
            fetchSchedules();
        } catch {
            info.revert();
            toast.error("Erro ao mover agendamento");
        }
    };

    const closeModal = () => { setShowModal(false); setEditingId(null); setForm(initialForm); };

    if (showModal) {
        return (
            <div className="w-full relative z-10 p-4 transition-all">
                <SchedulingModal
                    form={form}
                    setForm={setForm}
                    loading={loading}
                    editingId={editingId}
                    users={users}
                    departments={departments}
                    contacts={contacts}
                    searchContacts={searchContacts}
                    closeModal={closeModal}
                    handleSave={handleSave}
                />
            </div>
        );
    }

    return (
        <div className="liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white flex items-center gap-3">
                        <Calendar className="text-primary" size={28} /> Agenda
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        Gerencie seus agendamentos e disponibilidade
                    </p>
                </div>
                <button
                    onClick={() => { setEditingId(null); setForm(initialForm); setShowModal(true); }}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/30"
                >
                    <Plus size={16} /> Novo Agendamento
                </button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: "Total", value: stats.total, color: "text-slate-900 dark:text-white", accent: "bg-slate-100 dark:bg-white/5" },
                    { label: "Pendentes", value: stats.pending, color: "text-blue-600", accent: "bg-blue-500/10" },
                    { label: "Confirmados", value: stats.confirmed, color: "text-emerald-600", accent: "bg-emerald-500/10" },
                    { label: "Cancelados", value: stats.cancelled, color: "text-red-600", accent: "bg-red-500/10" },
                ].map((s, i) => (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className={`${s.accent} rounded-2xl p-5 border border-white/20 dark:border-white/5`}
                    >
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
                        <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <select
                    value={filters.userId}
                    onChange={e => setFilters({ ...filters, userId: e.target.value })}
                    className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                >
                    <option value="">Todos os Profissionais</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <select
                    value={filters.departmentId}
                    onChange={e => setFilters({ ...filters, departmentId: e.target.value })}
                    className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                >
                    <option value="">Todos os Departamentos</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                {fetching && (
                    <span className="text-[10px] text-primary font-black uppercase tracking-widest animate-pulse flex items-center gap-1">
                        <Clock size={12} /> Atualizando...
                    </span>
                )}
            </div>

            {/* Main layout: Calendar + Sidebar */}
            <div className="flex gap-6">
                {/* Calendar */}
                <div className="flex-1 rounded-[2rem] overflow-hidden border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl p-4 calendar-premium">
                    <FullCalendar
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="timeGridWeek"
                        locale={ptBr}
                        firstDay={1}
                        height="auto"
                        slotMinTime="07:00:00"
                        slotMaxTime="20:00:00"
                        slotDuration="00:30:00"
                        slotLabelInterval="01:00"
                        allDayText="Dia todo"
                        buttonText={{ today: "Hoje", week: "Semana", day: "Dia", month: "Mês" }}
                        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
                        dayHeaderFormat={{ weekday: "short", day: "2-digit" }}
                        events={events}
                        editable
                        selectable
                        select={handleSelect}
                        eventClick={(info) => setSelectedEvent(info.event.extendedProps.raw)}
                        eventDrop={handleEventDrop}
                        eventOverlap={false}
                        eventDisplay="block"
                    />
                </div>

                {/* Upcoming sidebar */}
                <div className="w-72 flex-shrink-0 space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <AlarmClock size={14} className="text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Próximos</p>
                    </div>
                    {upcoming.length === 0 ? (
                        <div className="text-center py-12 opacity-30">
                            <Calendar size={32} className="mx-auto mb-2" strokeWidth={1} />
                            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum próximo</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {upcoming.map(s => {
                                const cfg = STATUS_CONFIG[s.status as ScheduleStatus] || STATUS_CONFIG.PENDING;
                                return (
                                    <motion.button
                                        key={s.id}
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => setSelectedEvent(s)}
                                        className="w-full text-left p-4 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-[9px] font-black uppercase tracking-tighter px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
                                                {cfg.label}
                                            </span>
                                            <ChevronRight size={14} className="text-gray-300" />
                                        </div>
                                        <p className="text-sm font-black text-slate-800 dark:text-white truncate">{s.contact?.name || "—"}</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">{s.user?.name || "—"}</p>
                                        <div className="flex items-center gap-1 mt-2 text-[9px] text-slate-400 font-black">
                                            <Clock size={10} />
                                            {new Date(s.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} •{' '}
                                            {new Date(s.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Drawer detalhes */}
            <AnimatePresence>
                {selectedEvent && (
                    <SchedulingDrawer
                        event={selectedEvent}
                        onClose={() => setSelectedEvent(null)}
                        updateStatus={updateStatus}
                        deleteSchedule={deleteSchedule}
                        onEdit={openEditFromDrawer}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function SchedulingModal({ form, setForm, loading, editingId, users, departments, contacts, searchContacts, closeModal, handleSave }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-4xl mx-auto liquid-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-white/10 shadow-2xl bg-white dark:bg-slate-900 space-y-5"
        >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-gray-100 dark:border-white/5 gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black tracking-tighter italic">
                        {editingId ? "Editar Agendamento" : "Novo Agendamento"}
                    </h2>
                </div>
                <button onClick={closeModal} className="px-6 py-3 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
                    Voltar para Calendário
                </button>
            </div>

            <div className="space-y-4">
                {/* Contato */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contato</label>
                    <input
                        placeholder="Buscar contato..."
                        onChange={e => searchContacts(e.target.value)}
                        className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm bg-gray-50 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    />
                    {contacts.length > 0 && (
                        <select
                            value={form.contactId}
                            onChange={e => setForm({ ...form, contactId: e.target.value })}
                            className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm bg-gray-50 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                        >
                            <option value="">Selecionar contato</option>
                            {contacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                </div>

                {/* Profissional e Depto em row */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Profissional</label>
                        <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })}
                            className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm bg-gray-50 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all">
                            <option value="">Selecionar...</option>
                            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Departamento</label>
                        <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}
                            className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm bg-gray-50 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all">
                            <option value="">Selecionar...</option>
                            {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Datas */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Início</label>
                        <input type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}
                            className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm bg-gray-50 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fim</label>
                        <input type="datetime-local" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
                            className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm bg-gray-50 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
                    </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observações</label>
                    <textarea
                        placeholder="Notas adicionais..."
                        value={form.notes}
                        onChange={e => setForm({ ...form, notes: e.target.value })}
                        rows={3}
                        className="w-full border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm bg-gray-50 dark:bg-white/5 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
                <button onClick={closeModal}
                    className="px-5 py-2.5 text-sm font-black rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                    Cancelar
                </button>
                <button onClick={handleSave} disabled={loading}
                    className="px-8 py-2.5 bg-primary text-white rounded-xl text-sm font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:scale-100">
                    {loading ? "Salvando..." : "Salvar"}
                </button>
            </div>
        </motion.div>
    );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function SchedulingDrawer({ event, onClose, updateStatus, deleteSchedule, onEdit }: any) {
    if (!event) return null;
    const cfg = STATUS_CONFIG[event.status as ScheduleStatus] || STATUS_CONFIG.PENDING;

    const confirmDelete = () => {
        toast("Excluir este agendamento?", {
            action: { label: "Confirmar", onClick: () => deleteSchedule(event.id) },
            cancel: { label: "Cancelar", onClick: () => { } },
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end"
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative w-[420px] bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-gray-100 dark:border-white/10"
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-black tracking-tighter">Detalhes do Agendamento</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-black ${cfg.bg} ${cfg.color}`}>
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                    </span>

                    {/* Info cards */}
                    {[
                        { icon: User, label: "Cliente", value: event.contact?.name },
                        { icon: User, label: "Profissional", value: event.user?.name },
                        { icon: Building2, label: "Departamento", value: event.department?.name },
                        { icon: Clock, label: "Início", value: new Date(event.startTime).toLocaleString('pt-BR') },
                        { icon: Clock, label: "Fim", value: new Date(event.endTime).toLocaleString('pt-BR') },
                        ...(event.notes ? [{ icon: FileText, label: "Observações", value: event.notes }] : []),
                    ].map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl flex-shrink-0 mt-0.5">
                                <item.icon size={14} className="text-primary" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-gray-200 mt-0.5">{item.value || "—"}</p>
                            </div>
                        </div>
                    ))}

                    {/* Status Actions */}
                    <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alterar Status</p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: "Confirmar", status: "CONFIRMED", cls: "bg-emerald-500 hover:bg-emerald-600" },
                                { label: "Cancelar", status: "CANCELLED", cls: "bg-red-500 hover:bg-red-600" },
                                { label: "No Show", status: "NO_SHOW", cls: "bg-amber-500 hover:bg-amber-600" },
                                { label: "Pendente", status: "PENDING", cls: "bg-blue-500 hover:bg-blue-600" },
                            ].map(btn => (
                                <button key={btn.status} onClick={() => updateStatus(event.id, btn.status)}
                                    className={`py-2.5 rounded-xl text-xs font-black text-white uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${btn.cls} ${event.status === btn.status ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    disabled={event.status === btn.status}>
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer actions */}
                <div className="p-6 border-t border-gray-100 dark:border-white/10 flex gap-3">
                    <button onClick={onEdit}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/30">
                        <Pencil size={14} /> Editar
                    </button>
                    <button onClick={confirmDelete}
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-red-500/10 text-red-600 rounded-xl text-xs font-black hover:bg-red-500 hover:text-white transition-all">
                        <Trash2 size={14} />
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
