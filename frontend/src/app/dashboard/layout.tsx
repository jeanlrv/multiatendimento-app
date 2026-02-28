'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { ModeToggle } from '@/components/mode-toggle';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Clock, Upload, Menu, X } from 'lucide-react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTicketBadge } from '@/hooks/useTicketBadge';
import { KeyboardShortcutsPanel } from '@/components/keyboard-shortcuts-panel';
import { SessionTimeoutGuard } from '@/components/SessionTimeoutGuard';
import Link from 'next/link';
import { Toaster, toast } from 'sonner';
import { api } from '@/services/api';
import { hexToHsl } from '@/lib/colors';
import { InternalChatWidget } from '@/components/chat/InternalChatWidget';
import { PresenceSidebar } from '@/components/chat/PresenceSidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { Users as UsersIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SidebarContent = React.memo(({
    sidebarCollapsed,
    logoUrl,
    companyName,
    companyInitials,
    pathname,
    menuItems,
    logout,
    setMobileMenuOpen
}: {
    sidebarCollapsed: boolean;
    logoUrl?: string | null;
    companyName: string;
    companyInitials: string;
    pathname: string;
    menuItems: any[];
    logout: () => void;
    setMobileMenuOpen: (val: boolean) => void;
}) => (
    <>
        {/* Logo */}
        <div className={`${sidebarCollapsed ? 'p-4' : 'px-8 py-6'} flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-4'} transition-all duration-300`}>
            <div className={`${sidebarCollapsed ? 'h-10 w-10 rounded-xl' : 'h-12 w-auto min-w-[140px] rounded-2xl'} bg-gradient-to-br from-primary to-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden flex-shrink-0 transition-all duration-500`}>
                {logoUrl ? (
                    <img src={logoUrl} alt={companyName} className={`${sidebarCollapsed ? 'w-full h-full object-cover' : 'h-full w-full object-contain p-2 px-4'}`} />
                ) : (
                    <span className="text-white font-bold text-lg italic">{companyInitials}</span>
                )}
            </div>
        </div>

        {/* Nav */}
        <nav className={`flex-1 ${sidebarCollapsed ? 'px-2' : 'px-4'} space-y-1 overflow-y-auto custom-scrollbar transition-all duration-300`}>
            {!sidebarCollapsed && (
                <p className="px-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 mt-2 opacity-50">MENU PRINCIPAL</p>
            )}
            {menuItems.map((item) => {
                const isActive = pathname === item.path;
                const count = item.liveCount ?? 0;
                return (
                    <Link
                        key={item.label}
                        href={item.path}
                        className={`group flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} p-3 rounded-2xl transition-all duration-300 relative ${isActive
                            ? 'bg-primary text-white shadow-lg shadow-primary/30 font-bold scale-[1.02]'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5 hover:translate-x-1'
                            }`}
                        title={sidebarCollapsed ? item.label : ''}
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        <div className={`flex items-center ${sidebarCollapsed ? '' : 'gap-3'}`}>
                            <span className={`text-xl transition-transform group-hover:scale-110 ${isActive ? 'filter-none' : 'grayscale group-hover:grayscale-0'}`}>
                                {item.icon}
                            </span>
                            {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
                        </div>
                        {count > 0 && !sidebarCollapsed && (
                            <span className={`min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-black tabular-nums ${isActive ? 'bg-white/25 text-white' : 'bg-primary text-white'}`}>
                                {count > 99 ? '99+' : count}
                            </span>
                        )}
                        {count > 0 && sidebarCollapsed && (
                            <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900">
                                {count > 9 ? '9+' : count}
                            </span>
                        )}
                    </Link>
                );
            })}
        </nav>

        {/* Footer */}
        {!sidebarCollapsed ? (
            <div className="p-6 border-t border-gray-100/50 dark:border-white/5">

                <button onClick={logout} className="flex items-center gap-3 w-full p-3 text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 rounded-xl transition-all font-bold text-sm">
                    <span className="text-lg">🚪</span> Sair da Conta
                </button>
            </div>
        ) : (
            <div className="p-2 border-t border-gray-100/50 dark:border-white/5">
                <button onClick={logout} className="flex items-center justify-center w-full p-3 text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 rounded-xl transition-all" title="Sair da Conta">
                    <span className="text-lg">🚪</span>
                </button>
            </div>
        )}
    </>
));

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, company, logout, loading, updateUser } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
    const [presenceSidebarOpen, setPresenceSidebarOpen] = useState(false);
    const [time, setTime] = useState<Date | null>(null);
    const [zoom, setZoom] = useState<number>(100);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const ticketCount = useTicketBadge(user?.id);

    // Fechar menu mobile ao navegar
    useEffect(() => { setMobileMenuOpen(false); }, [pathname]);

    useEffect(() => {
        setTime(new Date());
        const timer = setInterval(() => setTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const savedZoom = localStorage.getItem('kszap_zoom');
        if (savedZoom) {
            const z = parseInt(savedZoom);
            setZoom(z);
            document.documentElement.style.fontSize = `${(z / 100) * 12.8}px`;
        }
    }, []);

    const handleZoom = (action: 'in' | 'out') => {
        setZoom(prev => {
            let next = prev;
            if (action === 'in' && prev < 130) next = prev + 10;
            if (action === 'out' && prev > 70) next = prev - 10;
            document.documentElement.style.fontSize = `${(next / 100) * 12.8}px`;
            localStorage.setItem('kszap_zoom', next.toString());
            return next;
        });
    };

    useEffect(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        if (saved) setSidebarCollapsed(JSON.parse(saved));
    }, []);

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
    }, [sidebarCollapsed]);

    useEffect(() => {
        if (company?.primaryColor) {
            try {
                const hsl = hexToHsl(company.primaryColor);
                document.documentElement.style.setProperty('--primary', hsl);
                document.documentElement.style.setProperty('--ring', hsl);
            } catch (e) {
                console.error('Erro ao aplicar cor de branding:', e);
            }
        }
    }, [company?.primaryColor]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const uploadResp = await api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            const { url } = uploadResp.data;
            await api.patch('/users/me/avatar', { avatarUrl: url });
            updateUser({ avatar: url });
            toast.success('Avatar atualizado!');
        } catch {
            toast.error('Erro ao atualizar avatar');
        }
    };

    useKeyboardShortcuts([
        { key: 'n', ctrl: true, description: 'Novo ticket', action: () => router.push('/dashboard/tickets') },
        { key: '/', ctrl: true, description: 'Mostrar atalhos', action: () => setShowShortcutsPanel(true) },
        { key: 'Escape', description: 'Fechar modal/painel', action: () => { setShowShortcutsPanel(false); setMobileMenuOpen(false); } },
    ]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (!user) { router.push('/login'); return null; }

    const menuItems = [
        { label: 'Dashboard', path: '/dashboard', icon: '📊' },
        { label: 'Chamados', path: '/dashboard/tickets', icon: '🎫', liveCount: ticketCount },
        { label: 'Contatos', path: '/dashboard/contacts', icon: '👤' },
        { label: 'Conexões', path: '/dashboard/connections', icon: '💬' },
        { label: 'Departamentos', path: '/dashboard/departments', icon: '🏢' },
        { label: 'Tags', path: '/dashboard/tags', icon: '🏷️' },
        { label: 'IA & Agentes', path: '/dashboard/ai-agents', icon: '🤖' },
        { label: 'Base de Conhecimento', path: '/dashboard/ai-knowledge', icon: '🧠' },
        { label: 'Busca Inteligente', path: '/dashboard/ai-search', icon: '🔍' },
        { label: 'Métricas de IA', path: '/dashboard/ai-metrics', icon: '📊' },
        { label: 'Automações', path: '/dashboard/workflows', icon: '⚡' },
        { label: 'Colaboração', path: '/dashboard/collab', icon: '💬' },
        { label: 'Agenda', path: '/dashboard/scheduling', icon: '📅' },
        { label: 'Qualidade', path: '/dashboard/evaluations', icon: '⭐' },
        { label: 'Equipe', path: '/dashboard/users', icon: '👥' },
        { label: 'Perfis de Acesso', path: '/dashboard/roles', icon: '🛡️' },
        { label: 'Intelligence HUB', path: '/dashboard/reports', icon: '📈' },
        { label: 'Meu Perfil', path: '/dashboard/profile', icon: '👤' },
        { label: 'Configurações', path: '/dashboard/settings', icon: '⚙️' },
    ];

    // Atalhos da bottom nav mobile (5 principais)
    const bottomNavItems = [
        { label: 'Dashboard', path: '/dashboard', icon: '📊' },
        { label: 'Chamados', path: '/dashboard/tickets', icon: '🎫', liveCount: ticketCount },
        { label: 'Contatos', path: '/dashboard/contacts', icon: '👤' },
        { label: 'Agenda', path: '/dashboard/scheduling', icon: '📅' },
        { label: 'Menu', path: '#', icon: '☰', isMenu: true },
    ];

    const logoUrl = company?.logoUrl;
    const companyName = company?.name || 'KSZap';
    const companyInitials = companyName.substring(0, 2).toUpperCase();



    return (
        <SessionTimeoutGuard>
            <div className="min-h-screen sober-gradient flex transition-colors duration-300 text-slate-900 dark:text-white">
                <Toaster position="top-right" richColors closeButton />

                {/* ── SIDEBAR DESKTOP (md+) ────────────────────────────────── */}
                <aside className={`${sidebarCollapsed ? 'w-20' : 'w-72'} flex-shrink-0 hidden md:flex flex-col relative z-30 transition-all duration-300`}>
                    <div className="absolute inset-0 liquid-glass !rounded-none border-r border-slate-200 dark:border-white/5 shadow-2xl pointer-events-none" />
                    <div className="relative z-10 w-full h-full flex flex-col pointer-events-auto">
                        <SidebarContent
                            sidebarCollapsed={sidebarCollapsed}
                            logoUrl={logoUrl}
                            companyName={companyName}
                            companyInitials={companyInitials}
                            pathname={pathname}
                            menuItems={menuItems}
                            logout={logout}
                            setMobileMenuOpen={setMobileMenuOpen}
                        />
                    </div>
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="absolute -right-3 top-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-full p-1.5 shadow-lg hover:scale-110 transition-transform z-50 flex items-center justify-center h-6 w-6 pointer-events-auto"
                        title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
                    >
                        {sidebarCollapsed ? <ChevronRight size={14} className="text-slate-600 dark:text-slate-400" /> : <ChevronLeft size={14} className="text-slate-600 dark:text-slate-400" />}
                    </button>
                </aside>

                {/* ── DRAWER MOBILE (< md) ─────────────────────────────────── */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                key="backdrop"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
                                onClick={() => setMobileMenuOpen(false)}
                            />
                            {/* Drawer */}
                            <motion.aside
                                key="drawer"
                                initial={{ x: '-100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '-100%' }}
                                transition={{ type: 'spring', stiffness: 300, damping: 35 }}
                                className="fixed top-0 left-0 h-full w-72 liquid-glass border-r border-slate-200 dark:border-white/10 z-50 flex flex-col shadow-2xl md:hidden"
                            >
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="absolute right-4 top-5 p-2 rounded-2xl hover:bg-white/20 text-slate-500 transition-all z-50"
                                >
                                    <X size={20} />
                                </button>
                                <SidebarContent
                                    sidebarCollapsed={false}
                                    logoUrl={logoUrl}
                                    companyName={companyName}
                                    companyInitials={companyInitials}
                                    pathname={pathname}
                                    menuItems={menuItems}
                                    logout={logout}
                                    setMobileMenuOpen={setMobileMenuOpen}
                                />
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
                <div className="flex-1 flex flex-col relative z-10 overflow-hidden min-w-0">

                    {/* ── HEADER ───────────────────────────────────────────── */}
                    <header className="h-16 md:h-24 flex items-center justify-between px-4 md:px-10 relative z-20 flex-shrink-0">
                        <div className="flex items-center gap-3 md:gap-10">
                            {/* Botão hamburger — só mobile */}
                            <button
                                onClick={() => setMobileMenuOpen(true)}
                                className="md:hidden p-2 rounded-2xl liquid-glass border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-white/50 transition-all"
                                aria-label="Abrir menu"
                            >
                                <Menu size={22} />
                            </button>

                            {/* Logo — visível em qualquer tamanho */}
                            <div className="h-10 md:h-14 w-auto min-w-[100px] md:min-w-[160px] bg-gradient-to-br from-primary to-primary-foreground rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0">
                                {logoUrl
                                    ? <img src={logoUrl} alt={companyName} className="h-full w-full object-contain p-1 px-3 md:p-2 md:px-5" />
                                    : <span className="text-white font-black text-base md:text-xl italic px-3 md:px-8">{companyName}</span>}
                            </div>

                            {/* Quick nav — apenas lg+ */}
                            <nav className="ks-capsule hidden lg:flex">
                                {menuItems.slice(0, 4).map((item) => (
                                    <Link key={item.label} href={item.path} className={`text-sm font-bold tracking-tight px-5 py-2 rounded-full transition-all ${pathname === item.path ? 'bg-primary text-white shadow-xl' : 'text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                        </div>

                        {/* Direita do header */}
                        <div className="flex items-center gap-2 md:gap-6">
                            {/* Relógio — oculto em xs */}
                            <div className="hidden sm:flex items-center gap-3 liquid-glass px-4 py-2.5 rounded-full border border-slate-200 dark:border-white/10 shadow-sm">
                                <Clock size={14} className="text-primary" />
                                <span className="text-xs font-bold text-slate-600 dark:text-white capitalize">
                                    {time ? `${time.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace(/ de /g, ' ').replace('.', '')} ${time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '—'}
                                </span>
                            </div>

                            {/* Zoom — apenas md+ */}
                            <div className="hidden md:flex items-center gap-2 liquid-glass px-2 py-1.5 rounded-full border border-slate-200 dark:border-white/10 shadow-sm">
                                <button onClick={() => handleZoom('out')} className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all" title="Diminuir Zoom"><ZoomOut size={16} /></button>
                                <span className="text-[10px] font-black w-8 text-center text-slate-500 dark:text-slate-400">{zoom}%</span>
                                <button onClick={() => handleZoom('in')} className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all" title="Aumentar Zoom"><ZoomIn size={16} /></button>
                            </div>

                            {/* Presença */}
                            <button onClick={() => setPresenceSidebarOpen(!presenceSidebarOpen)} className={`p-2 md:p-2.5 rounded-full border transition-all ${presenceSidebarOpen ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'liquid-glass border-slate-200 dark:border-white/10 text-slate-400 hover:text-primary'}`} title="Hub de Colaboradores">
                                <UsersIcon size={18} />
                            </button>

                            <NotificationBell />

                            <div className="flex items-center gap-2 md:gap-4 border-l pl-3 md:pl-6 border-slate-200 dark:border-white/10">
                                <ModeToggle />
                                <div className="relative group">
                                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                                    <Link href="/dashboard/profile" className="flex items-center gap-2 bg-white/5 p-1 rounded-full border border-white/10 pr-2 hover:bg-white/10 transition-all shadow-md">
                                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary overflow-hidden border border-white/20 flex-shrink-0">
                                            {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-white">{user.name.charAt(0).toUpperCase()}</div>}
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 hidden lg:block max-w-[80px] truncate">{user.name.split(' ')[0]}</span>
                                    </Link>
                                    <button onClick={() => avatarInputRef.current?.click()} className="absolute -bottom-1 -right-1 h-5 w-5 bg-primary text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" title="Trocar foto">
                                        <Upload size={10} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* ── CONTEÚDO + ESPAÇO PARA BOTTOM NAV ───────────────── */}
                    <main className="px-3 md:px-10 pb-24 md:pb-10 flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar">
                        {children}
                    </main>
                </div>

                {/* ── BOTTOM NAV MOBILE (< md) ─────────────────────────────── */}
                <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden liquid-glass border-t border-slate-200 dark:border-white/10 shadow-2xl">
                    <div className="flex items-center justify-around px-2 py-2 safe-area-bottom">
                        {bottomNavItems.map((item) => {
                            const isActive = !item.isMenu && pathname === item.path;
                            const count = (item as any).liveCount ?? 0;
                            return item.isMenu ? (
                                <button
                                    key="menu"
                                    onClick={() => setMobileMenuOpen(true)}
                                    className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-all ${mobileMenuOpen ? 'text-primary' : 'text-slate-400'}`}
                                >
                                    <span className="text-2xl">{item.icon}</span>
                                    <span className="text-[9px] font-black uppercase tracking-widest">Menu</span>
                                </button>
                            ) : (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-all ${isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {isActive && (
                                        <motion.div layoutId="bottomNavIndicator" className="absolute inset-0 bg-primary/10 rounded-2xl" />
                                    )}
                                    <span className="text-2xl relative z-10">{item.icon}</span>
                                    <span className="text-[9px] font-black uppercase tracking-widest relative z-10">{item.label}</span>
                                    {count > 0 && (
                                        <span className="absolute top-0 right-1 h-4 w-4 bg-primary text-white text-[8px] font-black rounded-full flex items-center justify-center">
                                            {count > 9 ? '9+' : count}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </nav>

                <KeyboardShortcutsPanel isOpen={showShortcutsPanel} onClose={() => setShowShortcutsPanel(false)} shortcuts={[
                    { key: 'n', ctrl: true, description: 'Novo ticket', action: () => { } },
                    { key: '/', ctrl: true, description: 'Mostrar atalhos', action: () => { } },
                    { key: 'Escape', description: 'Fechar modal/painel', action: () => { } },
                ]} />

                <div className={`fixed top-0 right-0 h-full z-[100] transition-transform duration-500 ease-in-out shadow-2xl ${presenceSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <PresenceSidebar onSelectUser={() => { }} />
                </div>
                {presenceSidebarOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[90]" onClick={() => setPresenceSidebarOpen(false)} />}

                <InternalChatWidget />
            </div>
        </SessionTimeoutGuard>
    );
}
