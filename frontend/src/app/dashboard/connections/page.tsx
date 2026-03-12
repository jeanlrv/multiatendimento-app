"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/services/api";
import { motion } from "framer-motion";
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
    ChevronLeft,
    Eye,
    EyeOff,
    Key,
    Hash,
    Phone,
    Shield,
    Link2,
} from "lucide-react";
import { toast } from "sonner";

interface Connection {
    id: string;
    name: string;
    phoneNumber?: string;
    status: "CONNECTED" | "DISCONNECTED" | "ERROR" | "WAITING_SCAN";
    zapiInstanceId?: string;
    zapiToken?: string;
    zapiClientToken?: string;
    departmentIds?: string[];
    department?: { id: string; name: string };
}

interface Department {
    id: string;
    name: string;
    emoji?: string;
}

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
        const [connResult, deptResult] = await Promise.allSettled([
            api.get("/whatsapp"),
            api.get("/departments"),
        ]);
        if (connResult.status === "fulfilled") {
            const conns: Connection[] = connResult.value.data;
            setConnections(conns);
            // Auto-check status silently para conexões com credenciais configuradas
            conns.forEach((conn) => {
                if (conn.zapiInstanceId) {
                    api.get(`/whatsapp/${conn.id}/status`)
                        .then(res => setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, status: res.data.status } : c)))
                        .catch(() => {});
                }
            });
        } else {
            toast.error("Erro ao carregar conexões.");
        }
        if (deptResult.status === "fulfilled") {
            const raw = deptResult.value.data;
            setDepartments(Array.isArray(raw) ? raw : (raw?.data ?? []));
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const fetchQrCode = useCallback(async (connId: string) => {
        setQrLoading(true);
        try {
            const response = await api.get(`/whatsapp/${connId}/qrcode`);
            setQrData(response.data.qrcode || null);
            setQrStatus(response.data.status || "WAITING_SCAN");
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

    const stopQrPolling = () => {
        if (qrPollRef.current) { clearInterval(qrPollRef.current); qrPollRef.current = null; }
    };

    const startQrPolling = useCallback((connId: string) => {
        stopQrPolling();
        fetchQrCode(connId);
        qrPollRef.current = setInterval(() => fetchQrCode(connId), QR_POLL_INTERVAL_MS);
    }, [fetchQrCode]);

    const handleOpenQr = (conn: Connection) => {
        if (!conn.zapiInstanceId) {
            toast.error("Configure o ID da Instância Z-API antes de escanear o QR Code.");
            return;
        }
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
            const label = status === "CONNECTED" ? "Conectado ✅" : status === "DISCONNECTED" ? "Desconectado ❌" : status;
            toast.info(`Status: ${label}`);
            setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, status: res.data.status } : c));
        } catch {
            toast.error("Erro ao verificar status");
        }
    };

    const handleRegisterWebhook = async (conn: Connection) => {
        if (!conn.zapiInstanceId) {
            toast.error("Configure o ID da Instância Z-API antes de registrar o webhook.");
            return;
        }
        try {
            const res = await api.post(`/whatsapp/${conn.id}/register-webhook`);
            const webhookUrl: string = res.data?.webhookUrl ?? "";
            if (webhookUrl) {
                navigator.clipboard.writeText(webhookUrl).catch(() => {});
                toast.success(`Webhook registrado na Z-API!\nURL: ${webhookUrl}\n(copiada para a área de transferência)`, { duration: 8000 });
            } else {
                toast.success("URL de webhook registrada na Z-API!");
            }
        } catch (err: any) {
            const msg = err.response?.data?.message || "Erro ao registrar webhook";
            toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
        }
    };

    const statusConfig = {
        CONNECTED:    { label: "ONLINE",     color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", dot: "bg-emerald-500 animate-pulse" },
        DISCONNECTED: { label: "OFFLINE",    color: "bg-rose-500/10 text-rose-500 border-rose-500/20",         dot: "bg-rose-500" },
        ERROR:        { label: "ERRO",       color: "bg-orange-500/10 text-orange-500 border-orange-500/20",   dot: "bg-orange-500" },
        WAITING_SCAN: { label: "AGUARDANDO", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",   dot: "bg-yellow-500 animate-pulse" },
    };

    // ── QR Code modal ────────────────────────────────────────────────────────
    if (showQr) {
        return (
            <div className="max-w-7xl mx-auto relative liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] pt-12 pb-12 flex flex-col items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 40 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="relative w-full max-w-md liquid-glass dark:bg-slate-900/90 rounded-[3rem] shadow-2xl p-10 text-center z-10 border border-slate-200 dark:border-white/10"
                >
                    <button onClick={handleCloseQr} className="absolute top-6 right-6 p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl">
                        <X size={18} className="text-slate-400" />
                    </button>

                    <h3 className="text-2xl font-black mb-1 text-slate-900 dark:text-white tracking-tighter italic">
                        Vincular <span className="text-primary">WhatsApp</span>
                    </h3>
                    <p className="text-xs text-slate-500 mb-2">
                        Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo
                    </p>
                    <div className="text-[10px] text-slate-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/20 rounded-xl px-3 py-2 mb-4 text-left leading-relaxed">
                        <strong className="text-amber-600 dark:text-amber-400">Já vinculou no portal Z-API?</strong> Feche este modal e use o botão <strong>STATUS</strong> para confirmar que a conexão está ativa.
                        O QR Code é necessário apenas para novas vinculações via este sistema.
                    </div>

                    <div className="bg-white p-6 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.1)] mb-4 min-h-[200px] flex items-center justify-center">
                        {qrLoading && !qrData ? (
                            <RefreshCcw className="animate-spin h-10 w-10 text-primary mx-auto" />
                        ) : qrStatus === "ERROR" ? (
                            <div className="text-center">
                                <AlertCircle size={40} className="text-red-500 mx-auto mb-2" />
                                <p className="text-xs text-red-500 font-bold">Erro ao buscar QR Code</p>
                                <p className="text-xs text-slate-400 mt-1">Verifique o ID e Token da instância</p>
                            </div>
                        ) : qrStatus === "CONNECTED" ? (
                            <div className="text-center">
                                <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-2" />
                                <p className="text-sm font-bold text-emerald-600">Conectado!</p>
                            </div>
                        ) : qrData ? (
                            <img src={`data:image/png;base64,${qrData}`} alt="QR Code WhatsApp" className="w-48 h-48 object-contain" />
                        ) : (
                            <RefreshCcw className="animate-spin h-10 w-10 text-primary mx-auto" />
                        )}
                    </div>

                    {qrStatus !== "CONNECTED" && qrStatus !== "ERROR" && (
                        <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1 mb-4">
                            <Clock size={10} /> QR Code atualizado automaticamente a cada 15 segundos
                        </p>
                    )}

                    <button onClick={handleCloseQr} className="w-full py-4 bg-slate-100 dark:bg-white/5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
                        Voltar
                    </button>
                </motion.div>
            </div>
        );
    }

    // ── Connection form ───────────────────────────────────────────────────────
    if (selectedConn) {
        return (
            <div className="space-y-10 max-w-7xl mx-auto relative liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] pt-6 pb-12">
                <ConnectionFormView
                    connection={selectedConn}
                    departments={departments}
                    onClose={() => setSelectedConn(null)}
                    onSave={() => { setSelectedConn(null); fetchData(); }}
                />
            </div>
        );
    }

    // ── Main list ─────────────────────────────────────────────────────────────
    return (
        <div className="space-y-10 max-w-7xl mx-auto relative liquid-glass aurora min-h-[calc(100dvh-6rem)] md:min-h-[calc(100vh-8rem)] pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10 px-4">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-4">
                        <Wifi className="text-primary h-10 w-10 shadow-[0_0_20px_rgba(56,189,248,0.3)]" />
                        Conexões <span className="text-primary italic">WhatsApp</span>
                    </h2>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 italic">
                        Gerencie suas instâncias Z-API · ID, Token e Departamentos por conexão
                    </p>
                </div>
                <button
                    onClick={() => setSelectedConn({ id: "", name: "", status: "DISCONNECTED", departmentIds: [] })}
                    className="bg-primary text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group active:scale-95 text-xs tracking-wider"
                >
                    <Plus className="group-hover:rotate-90 transition-transform h-4 w-4" />
                    <span className="hidden sm:inline">NOVA CONEXÃO</span>
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10 px-4">
                    {[1, 2, 3].map((i) => <div key={i} className="h-72 liquid-glass rounded-[3rem] animate-pulse" />)}
                </div>
            ) : connections.length === 0 ? (
                <div className="text-center py-24 text-slate-400">
                    <Smartphone size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-bold">Nenhuma conexão criada ainda.</p>
                    <p className="text-sm mt-1">Clique em <strong>NOVA CONEXÃO</strong> e informe o ID e Token da sua instância Z-API.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10 px-4">
                    {connections.map((conn) => {
                        const sc = statusConfig[conn.status] || statusConfig.DISCONNECTED;
                        const deptCount = conn.departmentIds?.length ?? (conn.department ? 1 : 0);
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
                                <p className="text-sm font-medium text-slate-500 mb-1">
                                    {conn.phoneNumber ? `📱 ${conn.phoneNumber}` : "Número não definido"}
                                </p>
                                {conn.zapiInstanceId && (
                                    <p className="text-xs text-slate-400 font-mono mb-2 truncate" title={conn.zapiInstanceId}>
                                        ID: {conn.zapiInstanceId}
                                    </p>
                                )}

                                {deptCount > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-4">
                                        {conn.departmentIds && conn.departmentIds.length > 0 ? (
                                            conn.departmentIds.slice(0, 3).map(id => {
                                                const dept = departments.find(d => d.id === id);
                                                return (
                                                    <span key={id} className="inline-block text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/10">
                                                        {dept?.emoji} {dept?.name || id.substring(0, 8)}
                                                    </span>
                                                );
                                            })
                                        ) : conn.department ? (
                                            <span className="inline-block text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-md border border-primary/10">
                                                {conn.department.name}
                                            </span>
                                        ) : null}
                                        {conn.departmentIds && conn.departmentIds.length > 3 && (
                                            <span className="inline-block text-xs text-slate-400 px-2 py-0.5">
                                                +{conn.departmentIds.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    <button
                                        onClick={() => handleCheckStatus(conn)}
                                        title="Verificar status da conexão na Z-API"
                                        className="py-3 px-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-bold uppercase tracking-wide rounded-xl hover:bg-primary hover:text-white transition-all flex flex-col items-center justify-center gap-1 shadow-md active:scale-95"
                                    >
                                        <RefreshCcw size={16} />
                                        <span>STATUS</span>
                                    </button>
                                    <button
                                        onClick={() => handleOpenQr(conn)}
                                        title="Vincular WhatsApp via QR Code"
                                        className="py-3 px-2 bg-white dark:bg-white/5 text-slate-500 rounded-xl hover:bg-primary hover:text-white transition-all border border-slate-200 dark:border-white/10 shadow-sm active:scale-95 flex flex-col items-center justify-center gap-1"
                                    >
                                        <QrCode size={16} />
                                        <span className="text-xs font-bold">QR</span>
                                    </button>
                                    <div className="flex flex-col gap-1.5">
                                        <button
                                            onClick={() => setSelectedConn(conn)}
                                            title="Editar conexão"
                                            className="flex-1 py-1.5 bg-white dark:bg-white/5 text-slate-500 rounded-xl hover:bg-primary hover:text-white transition-all border border-slate-200 dark:border-white/10 shadow-sm active:scale-95 flex items-center justify-center"
                                        >
                                            <Settings2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleRegisterWebhook(conn)}
                                            title="Registrar URL de webhook na Z-API"
                                            className="flex-1 py-1.5 bg-white dark:bg-white/5 text-slate-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all border border-slate-200 dark:border-white/10 shadow-sm active:scale-95 flex items-center justify-center"
                                        >
                                            <Link2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(conn.id)}
                                            title="Excluir conexão"
                                            className="flex-1 py-1.5 bg-white dark:bg-white/5 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-slate-200 dark:border-white/10 shadow-sm active:scale-95 flex items-center justify-center"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Connection form component ─────────────────────────────────────────────────
function ConnectionFormView({ connection, departments, onClose, onSave }: {
    connection: Connection;
    departments: Department[];
    onClose: () => void;
    onSave: () => void;
}) {
    const isNew = !connection.id;
    const [form, setForm] = useState({
        name: connection.name || "",
        phoneNumber: connection.phoneNumber || "",
        zapiInstanceId: connection.zapiInstanceId || "",
        zapiToken: "",               // nunca pré-preencher token mascarado
        zapiClientToken: "",         // nunca pré-preencher token mascarado
        departmentIds: connection.departmentIds || (connection.department ? [connection.department.id] : []) as string[],
    });
    const [showToken, setShowToken] = useState(false);
    const [showClientToken, setShowClientToken] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const toggleDept = (deptId: string) => {
        setForm(f => ({
            ...f,
            departmentIds: f.departmentIds.includes(deptId)
                ? f.departmentIds.filter(id => id !== deptId)
                : [...f.departmentIds, deptId],
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload: any = {
                name: form.name,
                phoneNumber: form.phoneNumber || undefined,
                zapiInstanceId: form.zapiInstanceId || undefined,
                departmentIds: form.departmentIds,
            };
            // Só envia tokens se o usuário preencheu (não sobrescreve com vazio)
            if (form.zapiToken.trim()) payload.zapiToken = form.zapiToken.trim();
            if (form.zapiClientToken.trim()) payload.zapiClientToken = form.zapiClientToken.trim();

            if (isNew) {
                await api.post("/whatsapp", payload);
                toast.success("Conexão criada com sucesso!");
            } else {
                await api.patch(`/whatsapp/${connection.id}`, payload);
                toast.success("Conexão atualizada com sucesso!");
            }
            onSave();
        } catch (err: any) {
            const msg = err.response?.data?.message || "Erro ao salvar conexão";
            toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl mx-auto liquid-glass rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border border-white/10 shadow-2xl"
        >
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl flex items-center justify-center text-white bg-primary shadow-lg shadow-primary/10">
                        <Smartphone className="h-6 w-6 md:h-8 md:w-8" />
                    </div>
                    <div>
                        <button type="button" onClick={onClose} className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors text-xs font-black uppercase tracking-widest mb-1">
                            <ChevronLeft size={16} /> Voltar para Conexões
                        </button>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-tight">
                            {isNew ? "Nova" : "Editar"} <span className="text-primary italic">Conexão</span>
                        </h3>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                {/* Nome */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1 flex items-center gap-2">
                        <Smartphone size={12} /> Nome da Conexão
                    </label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-5 py-3 focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white font-semibold"
                        placeholder="Ex: Comercial, Suporte, Vendas"
                        required
                    />
                </div>

                {/* Número de telefone */}
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1 flex items-center gap-2">
                        <Phone size={12} /> Número WhatsApp
                    </label>
                    <input
                        type="text"
                        value={form.phoneNumber}
                        onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-5 py-3 focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white font-semibold font-mono"
                        placeholder="5511999999999  (com DDI e DDD, sem + ou espaços)"
                    />
                </div>

                {/* Seção Z-API */}
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-6 space-y-5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Key size={13} className="text-primary" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Credenciais Z-API</span>
                        <span className="ml-auto text-[10px] text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg">Obtidas no portal z-api.io</span>
                    </div>

                    {/* Instance ID */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1 flex items-center gap-2">
                            <Hash size={12} /> ID da Instância
                        </label>
                        <input
                            type="text"
                            value={form.zapiInstanceId}
                            onChange={e => setForm({ ...form, zapiInstanceId: e.target.value })}
                            className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-5 py-3 focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white font-mono text-sm"
                            placeholder="Ex: 3DFC7BC50A44DF8F..."
                        />
                    </div>

                    {/* Token */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1 flex items-center gap-2">
                            <Key size={12} /> Token da Instância
                        </label>
                        <div className="relative">
                            <input
                                type={showToken ? "text" : "password"}
                                value={form.zapiToken}
                                onChange={e => setForm({ ...form, zapiToken: e.target.value })}
                                className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-5 py-3 pr-12 focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white font-mono text-sm"
                                placeholder={isNew ? "Cole o token aqui" : "Deixe em branco para manter o atual"}
                            />
                            <button type="button" onClick={() => setShowToken(!showToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors">
                                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Client Token */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1 flex items-center gap-2">
                            <Shield size={12} /> Client-Token (Security Token) <span className="text-slate-400 font-normal normal-case tracking-normal">— opcional</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showClientToken ? "text" : "password"}
                                value={form.zapiClientToken}
                                onChange={e => setForm({ ...form, zapiClientToken: e.target.value })}
                                className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-5 py-3 pr-12 focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white font-mono text-sm"
                                placeholder="Necessário apenas se ativado em Security no portal Z-API"
                            />
                            <button type="button" onClick={() => setShowClientToken(!showClientToken)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors">
                                {showClientToken ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="text-[10px] text-slate-400 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/20 rounded-xl p-3 leading-relaxed">
                        <strong className="text-primary">Como obter:</strong> Acesse <strong>z-api.io → Suas Instâncias → selecione a instância</strong>.
                        O <em>ID da instância</em> e o <em>Token</em> ficam em "Instância". O <em>Client-Token</em> fica em "Security" (se ativado).
                    </div>
                </div>

                {/* Departamentos */}
                {departments.length > 0 && (
                    <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">
                            Departamentos Vinculados
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {departments.map((dept) => {
                                const selected = form.departmentIds.includes(dept.id);
                                return (
                                    <button
                                        key={dept.id}
                                        type="button"
                                        onClick={() => toggleDept(dept.id)}
                                        className={`p-4 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2 ${
                                            selected
                                                ? "bg-primary border-primary text-white shadow-md"
                                                : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:border-primary/30"
                                        }`}
                                    >
                                        {selected && <CheckCircle2 size={12} className="flex-shrink-0" />}
                                        {dept.emoji && <span>{dept.emoji}</span>}
                                        <span className="truncate">{dept.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-slate-500 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800/30 leading-relaxed">
                            <span className="font-bold text-primary">DICA:</span> Mensagens recebidas serão roteadas para o primeiro departamento selecionado.
                            Selecione <strong>múltiplos</strong> para identificar em quais departamentos esta conexão atua.
                            Sem seleção = atende <strong>todos os departamentos</strong>.
                        </p>
                    </div>
                )}

                {/* Actions */}
                <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex gap-4">
                    <button type="button" onClick={onClose} className="px-6 py-4 rounded-xl border border-slate-200 dark:border-white/10 font-bold text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                        DESCARTAR
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 bg-primary text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 hover:scale-[1.01] active:scale-95 text-sm tracking-widest"
                    >
                        {submitting ? <RefreshCcw className="animate-spin h-5 w-5" /> : <><Save size={18} />{isNew ? "CRIAR CONEXÃO" : "SALVAR ALTERAÇÕES"}</>}
                    </button>
                </div>
            </form>
        </motion.div>
    );
}
