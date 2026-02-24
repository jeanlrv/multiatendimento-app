"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/services/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    Smartphone,
    Plus,
    Trash2,
    RefreshCcw,
    CheckCircle2,
    Wifi,
    AlertCircle,
    X,
    Save,
    QrCode,
    Settings2,
    Clock,
} from "lucide-react";
import { toast } from "sonner";

interface Connection {
    id: string;
    name: string;
    phoneNumber?: string;
    status: "CONNECTED" | "DISCONNECTED" | "ERROR" | "WAITING_SCAN";
    zapiInstanceId?: string;
    department?: { id: string; name: string };
}

interface Department {
    id: string;
    name: string;
    emoji?: string;
}

// QR Code expira a cada ~20s — fazemos polling a cada 15s para garantir atualização
const QR_POLL_INTERVAL_MS = 15_000;

export default function ConnectionsPage() {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [showQr, setShowQr] = useState(false);
    const [qrConnectionId, setQrConnectionId] = useState<string | null>(null);
    const [qrData, setQrData] = useState<string | null>(null);
    const [qrStatus, setQrStatus] = useState<string>("WAITING_SCAN");
    const [qrLoading, setQrLoading] = useState(false);
    const [selectedConn, setSelectedConn] = useState<Connection | null>(null);
    const qrPollRef = useRef<NodeJS.Timeout | null>(null);

    const fetchData = useCallback(async () => {
        // Promise.allSettled: conexões carregam mesmo se departamentos falharem
        const [connResult, deptResult] = await Promise.allSettled([
            api.get("/whatsapp"),
            api.get("/departments"),
        ]);

        if (connResult.status === "fulfilled") {
            setConnections(connResult.value.data);
        } else {
            toast.error("Erro ao carregar conexões. Verifique se o servidor está online.");
        }

        if (deptResult.status === "fulfilled") {
            // departments pode retornar paginado { data: [...] } ou direto [...]
            const raw = deptResult.value.data;
            setDepartments(Array.isArray(raw) ? raw : (raw?.data ?? []));
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Polling do QR Code — busca a cada QR_POLL_INTERVAL_MS enquanto o modal está aberto
    const fetchQrCode = useCallback(async (connId: string) => {
        if (!connId) return;
        setQrLoading(true);
        try {
            const response = await api.get(`/whatsapp/${connId}/qrcode`);
            setQrData(response.data.qrcode || null);
            setQrStatus(response.data.status || "WAITING_SCAN");

            // Se conectou, parar o polling e atualizar a lista
            if (response.data.status === "CONNECTED") {
                stopQrPolling();
                toast.success("WhatsApp conectado com sucesso!");
                fetchData();
            }
        } catch {
            setQrData(null);
            setQrStatus("ERROR");
        } finally {
            setQrLoading(false);
        }
    }, [fetchData]);

    const startQrPolling = useCallback((connId: string) => {
        stopQrPolling();
        fetchQrCode(connId);
        qrPollRef.current = setInterval(() => fetchQrCode(connId), QR_POLL_INTERVAL_MS);
    }, [fetchQrCode]);

    const stopQrPolling = () => {
        if (qrPollRef.current) {
            clearInterval(qrPollRef.current);
            qrPollRef.current = null;
        }
    };

    const handleOpenQr = (conn: Connection) => {
        setQrConnectionId(conn.id);
        setQrData(null);
        setQrStatus("WAITING_SCAN");
        setShowQr(true);
        startQrPolling(conn.id);
    };

    const handleCloseQr = () => {
        stopQrPolling();
        setShowQr(false);
        setQrConnectionId(null);
        setQrData(null);
    };

    // Parar polling ao desmontar componente
    useEffect(() => () => stopQrPolling(), []);

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja realmente excluir esta conexão?")) return;
        try {
            await api.delete(`/whatsapp/${id}`);
            toast.success("Conexão removida");
            fetchData();
        } catch (err: any) {
            const msg = err.response?.data?.message || "Erro ao excluir conexão";
            toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
        }
    };

    const handleCheckStatus = async (conn: Connection) => {
        try {
            const res = await api.get(`/whatsapp/${conn.id}/status`);
            const status = res.data.status;
            toast.info(`Status: ${status === "CONNECTED" ? "Conectado ✅" : "Desconectado ❌"}`);
            fetchData();
        } catch {
            toast.error("Erro ao verificar status");
        }
    };

    const statusConfig = {
        CONNECTED: { label: "ONLINE", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", dot: "bg-emerald-500 animate-pulse" },
        DISCONNECTED: { label: "OFFLINE", color: "bg-rose-500/10 text-rose-500 border-rose-500/20", dot: "bg-rose-500" },
        ERROR: { label: "ERRO", color: "bg-orange-500/10 text-orange-500 border-orange-500/20", dot: "bg-orange-500" },
        WAITING_SCAN: { label: "AGUARDANDO", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", dot: "bg-yellow-500 animate-pulse" },
    };

    return (
        <>
            <div className="space-y-10 max-w-7xl mx-auto relative liquid-glass aurora pb-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10 px-4">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-4">
                            <Wifi className="text-primary h-10 w-10 shadow-[0_0_20px_rgba(56,189,248,0.3)]" />
                            Base <span className="text-primary italic">Aero</span>
                        </h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 italic">
                            Gestão de Canais WhatsApp — Credenciais em Configurações → Integrações
                        </p>
                    </div>
                    <button
                        onClick={() => setSelectedConn({ id: "", name: "", status: "DISCONNECTED" })}
                        className="bg-primary text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group active:scale-95 text-xs tracking-wider"
                    >
                        <Plus className="group-hover:rotate-90 transition-transform h-4 w-4" />
                        <span className="hidden sm:inline">NOVA CONEXÃO</span>
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10 px-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-72 liquid-glass rounded-[3rem] animate-pulse" />
                        ))}
                    </div>
                ) : connections.length === 0 ? (
                    <div className="text-center py-24 text-slate-400">
                        <Smartphone size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="font-bold">Nenhuma conexão criada ainda.</p>
                        <p className="text-sm mt-1">Primeiro configure as credenciais Z-API em <strong>Configurações → Integrações</strong>.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10 px-4">
                        {connections.map((conn) => {
                            const sc = statusConfig[conn.status] || statusConfig.DISCONNECTED;
                            return (
                                <motion.div
                                    key={conn.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ y: -6, scale: 1.01 }}
                                    className="liquid-glass dark:bg-transparent p-8 rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-2xl transition-all relative overflow-hidden group"
                                >
                                    <div className="flex items-start justify-between mb-6">
                                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-2xl transform -rotate-6 group-hover:rotate-0 transition-transform ${conn.status === "CONNECTED" ? "bg-primary shadow-primary/40" : "bg-slate-400"}`}>
                                            <Smartphone size={28} />
                                        </div>
                                        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm border ${sc.color}`}>
                                            <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
                                            {sc.label}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{conn.name}</h3>
                                    <p className="text-sm font-medium text-slate-500 mb-2">
                                        {conn.phoneNumber || "Número não definido"}
                                    </p>

                                    {conn.department && (
                                        <span className="inline-block text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-md border border-primary/10 mb-4">
                                            {conn.department.name}
                                        </span>
                                    )}

                                    <div className="grid grid-cols-3 gap-2 mt-4">
                                        <button
                                            onClick={() => handleOpenQr(conn)}
                                            className="py-3 px-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-bold uppercase tracking-wide rounded-xl hover:bg-primary hover:text-white transition-all flex flex-col items-center justify-center gap-1 shadow-md active:scale-95"
                                        >
                                            <QrCode size={16} />
                                            <span>QR</span>
                                        </button>
                                        <button
                                            onClick={() => handleCheckStatus(conn)}
                                            className="py-3 px-2 bg-white dark:bg-white/5 text-slate-500 rounded-xl hover:bg-primary hover:text-white transition-all border border-slate-200 dark:border-white/10 shadow-sm active:scale-95 flex flex-col items-center justify-center gap-1"
                                        >
                                            <RefreshCcw size={16} />
                                            <span className="text-xs font-bold">STATUS</span>
                                        </button>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => setSelectedConn(conn)}
                                                className="flex-1 py-2 bg-white dark:bg-white/5 text-slate-500 rounded-xl hover:bg-primary hover:text-white transition-all border border-slate-200 dark:border-white/10 shadow-sm active:scale-95 flex items-center justify-center"
                                            >
                                                <Settings2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(conn.id)}
                                                className="flex-1 py-2 bg-white dark:bg-white/5 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-slate-200 dark:border-white/10 shadow-sm active:scale-95 flex items-center justify-center"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal QR Code com polling automático */}
            <AnimatePresence>
                {showQr && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleCloseQr}
                            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 40 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 40 }}
                            className="relative w-full max-w-sm liquid-glass dark:bg-slate-900/90 rounded-[3rem] shadow-2xl p-10 text-center z-10 border border-slate-200 dark:border-white/10"
                        >
                            <button
                                onClick={handleCloseQr}
                                className="absolute top-6 right-6 p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"
                            >
                                <X size={18} className="text-slate-400" />
                            </button>

                            <h3 className="text-2xl font-black mb-1 text-slate-900 dark:text-white tracking-tighter italic">
                                Conectar <span className="text-primary">WhatsApp</span>
                            </h3>
                            <p className="text-xs text-slate-500 mb-6">
                                Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo
                            </p>

                            <div className="bg-white p-6 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.1)] mb-4 min-h-[200px] flex items-center justify-center">
                                {qrLoading && !qrData ? (
                                    <RefreshCcw className="animate-spin h-10 w-10 text-primary mx-auto" />
                                ) : qrStatus === "ERROR" ? (
                                    <div className="text-center">
                                        <AlertCircle size={40} className="text-red-500 mx-auto mb-2" />
                                        <p className="text-xs text-red-500 font-bold">Verifique as credenciais Z-API</p>
                                        <p className="text-xs text-slate-400 mt-1">Configurações → Integrações</p>
                                    </div>
                                ) : qrStatus === "CONNECTED" ? (
                                    <div className="text-center">
                                        <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-2" />
                                        <p className="text-sm font-bold text-emerald-600">Conectado!</p>
                                    </div>
                                ) : qrData ? (
                                    <img
                                        src={`data:image/png;base64,${qrData}`}
                                        alt="QR Code WhatsApp"
                                        className="w-48 h-48 object-contain"
                                    />
                                ) : (
                                    <RefreshCcw className="animate-spin h-10 w-10 text-primary mx-auto" />
                                )}
                            </div>

                            {qrStatus !== "CONNECTED" && qrStatus !== "ERROR" && (
                                <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1 mb-4">
                                    <Clock size={10} />
                                    QR Code atualizado automaticamente a cada 15 segundos
                                </p>
                            )}

                            <button
                                onClick={handleCloseQr}
                                className="w-full py-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                            >
                                FECHAR
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Drawer de criação/edição de conexão */}
            <AnimatePresence>
                {selectedConn && (
                    <ConnectionDrawer
                        connection={selectedConn}
                        departments={departments}
                        onClose={() => setSelectedConn(null)}
                        onSave={fetchData}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

function ConnectionDrawer({ connection, departments, onClose, onSave }: any) {
    const isNew = !connection.id;
    const [form, setForm] = useState({
        name: connection.name || "",
        departmentId: connection.department?.id || "",
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (isNew) {
                await api.post("/whatsapp", form);
                toast.success("Conexão criada com sucesso");
            } else {
                await api.patch(`/whatsapp/${connection.id}`, form);
                toast.success("Conexão atualizada com sucesso");
            }
            onSave();
            onClose();
        } catch (err: any) {
            const msg = err.response?.data?.message || "Erro ao salvar conexão";
            toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-end">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm"
            />
            <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative w-full max-w-xl h-full bg-white dark:bg-slate-900 shadow-[-20px_0_80px_rgba(0,0,0,0.1)] overflow-y-auto border-l border-slate-200 dark:border-white/10"
            >
                <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-10">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {isNew ? "Nova" : "Editar"} <span className="text-primary">Conexão</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            As credenciais Z-API são gerenciadas em{" "}
                            <strong className="text-primary">Configurações → Integrações</strong>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-10 space-y-10">
                    {/* Nome */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">
                            Nome da Conexão
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-5 py-3 focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white font-semibold text-lg"
                            placeholder="Ex: Comercial, Suporte, Vendas"
                            required
                        />
                    </div>

                    {/* Departamento */}
                    {departments.length > 0 && (
                        <div className="space-y-4">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">
                                Departamento Vinculado
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {departments.map((dept: any) => (
                                    <button
                                        key={dept.id}
                                        type="button"
                                        onClick={() => setForm({ ...form, departmentId: dept.id === form.departmentId ? "" : dept.id })}
                                        className={`p-4 rounded-xl border text-xs font-bold transition-all text-left ${form.departmentId === dept.id
                                            ? "bg-primary border-primary text-white shadow-md"
                                            : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:border-primary/30"
                                            }`}
                                    >
                                        {dept.emoji && <span className="mr-1">{dept.emoji}</span>}
                                        {dept.name}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800/30 leading-relaxed">
                                <span className="font-bold text-primary">DICA:</span> As mensagens recebidas nesta conexão WhatsApp serão roteadas para o departamento selecionado.
                            </p>
                        </div>
                    )}

                    <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 text-sm tracking-widest group"
                        >
                            {submitting ? (
                                <RefreshCcw className="animate-spin h-5 w-5" />
                            ) : (
                                <>
                                    <Save size={18} />
                                    {isNew ? "CRIAR CONEXÃO" : "SALVAR ALTERAÇÕES"}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
