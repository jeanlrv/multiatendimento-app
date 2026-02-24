'use client';

import { useState } from 'react';
import Link from 'next/link';

const features = [
    {
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
        ),
        title: 'Multi-WhatsApp Unificado',
        description: 'Gerencie múltiplos números do WhatsApp em um único painel. Distribua atendimentos por departamento e agente automaticamente.',
    },
    {
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
        ),
        title: 'IA Conversacional',
        description: 'Respostas automáticas inteligentes baseadas na sua base de conhecimento. Reduza o volume de atendimentos em até 60%.',
    },
    {
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
        ),
        title: 'Workflows e Automação',
        description: 'Crie regras automáticas de roteamento, respostas, tags e escalações. Seu time foca no que importa.',
    },
    {
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
        ),
        title: 'Colaboração em Tempo Real',
        description: 'Notas internas, transferências de atendimento, chats entre agentes e histórico completo de cada conversa.',
    },
    {
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
        ),
        title: 'Relatórios e Métricas',
        description: 'Dashboards em tempo real com TMA, TME, CSAT, volume por canal, agente e período. Decisões baseadas em dados.',
    },
    {
        icon: (
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
        ),
        title: 'Segurança Enterprise',
        description: 'Permissões granulares por função, auditoria completa de ações, criptografia AES-256 e autenticação JWT com refresh token.',
    },
];

const plans = [
    {
        id: 'basic',
        name: 'Basic',
        tagline: 'Para times iniciando o atendimento digital',
        monthlyPrice: 297,
        annualPrice: 249,
        highlight: false,
        badge: null,
        agentLimit: '3 agentes incluídos',
        extraAgent: 'R$79/agente adicional',
        whatsapp: '2 conexões WhatsApp',
        features: [
            { ok: true,  text: 'Atendimento via WhatsApp' },
            { ok: true,  text: 'Caixa de entrada unificada' },
            { ok: true,  text: 'Tickets e filas básicas' },
            { ok: true,  text: 'Transferência entre agentes' },
            { ok: true,  text: 'Tags e filtros' },
            { ok: true,  text: 'Relatórios básicos' },
            { ok: true,  text: 'App mobile (PWA)' },
            { ok: false, text: 'IA Conversacional' },
            { ok: false, text: 'Workflows e automação' },
            { ok: false, text: 'CRM de contatos' },
            { ok: false, text: 'White-label' },
            { ok: false, text: 'SLA garantido' },
        ],
        cta: 'Começar grátis por 14 dias',
        ctaStyle: 'border border-slate-300 text-slate-800 hover:border-indigo-500 hover:text-indigo-600',
    },
    {
        id: 'pro',
        name: 'Pro',
        tagline: 'Para times que buscam escala com IA',
        monthlyPrice: 697,
        annualPrice: 597,
        highlight: true,
        badge: 'Mais popular',
        agentLimit: '10 agentes incluídos',
        extraAgent: 'R$59/agente adicional',
        whatsapp: '5 conexões WhatsApp',
        features: [
            { ok: true,  text: 'Tudo do Basic' },
            { ok: true,  text: 'IA Conversacional (RAG)' },
            { ok: true,  text: 'Workflows e automação' },
            { ok: true,  text: 'CRM de contatos completo' },
            { ok: true,  text: 'Relatórios avançados + exportação' },
            { ok: true,  text: 'Avaliação de atendimento (CSAT)' },
            { ok: true,  text: 'Agendamentos e follow-ups' },
            { ok: true,  text: 'Chat interno entre agentes' },
            { ok: true,  text: 'Suporte prioritário (24h)' },
            { ok: false, text: 'White-label' },
            { ok: false, text: 'SLA garantido 99.9%' },
            { ok: false, text: 'Gerente de conta dedicado' },
        ],
        cta: 'Começar grátis por 14 dias',
        ctaStyle: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200',
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        tagline: 'Para operações de grande escala',
        monthlyPrice: 1997,
        annualPrice: 1697,
        highlight: false,
        badge: 'Sob consulta',
        agentLimit: 'Agentes ilimitados',
        extraAgent: 'Incluso no plano',
        whatsapp: 'WhatsApp ilimitado',
        features: [
            { ok: true,  text: 'Tudo do Pro' },
            { ok: true,  text: 'White-label completo' },
            { ok: true,  text: 'IA personalizada por empresa' },
            { ok: true,  text: 'SLA 99.9% garantido em contrato' },
            { ok: true,  text: 'Auditoria e compliance' },
            { ok: true,  text: 'SSO / Integração LDAP' },
            { ok: true,  text: 'API dedicada + webhooks' },
            { ok: true,  text: 'Onboarding guiado' },
            { ok: true,  text: 'Gerente de conta dedicado' },
            { ok: true,  text: 'Suporte 24/7 com SLA 2h' },
            { ok: true,  text: 'Personalização de módulos' },
            { ok: true,  text: 'Infraestrutura dedicada (opcional)' },
        ],
        cta: 'Falar com consultor',
        ctaStyle: 'border border-slate-300 text-slate-800 hover:border-indigo-500 hover:text-indigo-600',
    },
];

const comparisonRows = [
    { feature: 'Agentes incluídos', basic: '3', pro: '10', enterprise: 'Ilimitado' },
    { feature: 'Conexões WhatsApp', basic: '2', pro: '5', enterprise: 'Ilimitado' },
    { feature: 'IA Conversacional', basic: false, pro: true, enterprise: true },
    { feature: 'Workflows e automação', basic: false, pro: true, enterprise: true },
    { feature: 'CRM de contatos', basic: false, pro: true, enterprise: true },
    { feature: 'Relatórios avançados', basic: false, pro: true, enterprise: true },
    { feature: 'CSAT e avaliações', basic: false, pro: true, enterprise: true },
    { feature: 'White-label', basic: false, pro: false, enterprise: true },
    { feature: 'SLA garantido 99.9%', basic: false, pro: false, enterprise: true },
    { feature: 'Gerente de conta', basic: false, pro: false, enterprise: true },
    { feature: 'Suporte', basic: 'E-mail (48h)', pro: 'Prioritário (24h)', enterprise: '24/7 com SLA 2h' },
    { feature: 'Preço mensal', basic: 'R$297/mês', pro: 'R$697/mês', enterprise: 'A partir de R$1.997' },
    { feature: 'Preço anual', basic: 'R$249/mês', pro: 'R$597/mês', enterprise: 'Sob consulta' },
];

const testimonials = [
    {
        quote: 'O KSZap transformou nosso atendimento. Reduzimos o tempo médio de resposta de 4 horas para 8 minutos com os workflows automáticos.',
        author: 'Mariana Costa',
        role: 'Diretora de Customer Success',
        company: 'TechBrasil',
        initials: 'MC',
        color: 'from-violet-500 to-indigo-500',
    },
    {
        quote: 'A IA respondeu 58% dos chamados sem precisar de agente humano no primeiro mês. O ROI foi imediato.',
        author: 'Rafael Santos',
        role: 'CEO',
        company: 'GrowthStore',
        initials: 'RS',
        color: 'from-emerald-500 to-teal-500',
    },
    {
        quote: 'Finalmente uma ferramenta que não precisa de 3 meses de implantação. Em 2 dias estávamos atendendo com a plataforma.',
        author: 'Carla Mendes',
        role: 'Coordenadora de Atendimento',
        company: 'SaudeNet',
        initials: 'CM',
        color: 'from-rose-500 to-pink-500',
    },
];

function CheckIcon({ ok }: { ok: boolean }) {
    if (ok) {
        return (
            <svg className="w-5 h-5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
        );
    }
    return (
        <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

function TableCheck({ value }: { value: boolean | string }) {
    if (typeof value === 'string') return <span className="text-sm text-slate-700">{value}</span>;
    if (value) {
        return (
            <svg className="w-5 h-5 text-indigo-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
        );
    }
    return <span className="text-slate-300 text-xl">–</span>;
}

export default function LandingPage() {
    const [annual, setAnnual] = useState(false);

    return (
        <div className="min-h-screen bg-white text-slate-900 antialiased">

            {/* ── Navbar ─────────────────────────────────────────── */}
            <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                            </svg>
                        </div>
                        <span className="font-bold text-lg tracking-tight">KSZap</span>
                    </div>
                    <nav className="hidden md:flex items-center gap-7 text-sm text-slate-600">
                        <a href="#funcionalidades" className="hover:text-indigo-600 transition-colors">Funcionalidades</a>
                        <a href="#planos" className="hover:text-indigo-600 transition-colors">Planos</a>
                        <a href="#comparativo" className="hover:text-indigo-600 transition-colors">Comparativo</a>
                        <a href="#depoimentos" className="hover:text-indigo-600 transition-colors">Clientes</a>
                    </nav>
                    <div className="flex items-center gap-3">
                        <Link href="/login" className="text-sm text-slate-600 hover:text-indigo-600 transition-colors font-medium">
                            Entrar
                        </Link>
                        <Link href="/login" className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium shadow-sm">
                            Testar grátis
                        </Link>
                    </div>
                </div>
            </header>

            <main className="pt-16">

                {/* ── Hero ───────────────────────────────────────────── */}
                <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 text-white">
                    {/* decorative blobs */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-3xl" />
                        <div className="absolute top-60 -left-32 w-[400px] h-[400px] bg-violet-600/15 rounded-full blur-3xl" />
                    </div>

                    <div className="relative max-w-7xl mx-auto px-6 py-28 md:py-36 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-8">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                            Plataforma de atendimento multi-WhatsApp com IA
                        </div>

                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
                            Transforme seu WhatsApp<br />
                            em uma{' '}
                            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                                central de atendimento
                            </span>
                        </h1>

                        <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-300 leading-relaxed mb-10">
                            Unifique múltiplos números, distribua chamados automaticamente, responda com IA e acompanhe cada atendimento — tudo em um único painel.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/login"
                                className="px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base transition-all shadow-lg shadow-indigo-900/40"
                            >
                                Começar grátis — 14 dias
                            </Link>
                            <a
                                href="#planos"
                                className="px-8 py-4 rounded-xl border border-white/20 hover:border-white/40 text-white font-semibold text-base transition-all"
                            >
                                Ver planos e preços
                            </a>
                        </div>

                        <p className="mt-6 text-slate-400 text-sm">Sem cartão de crédito · Cancele quando quiser · Setup em menos de 5 minutos</p>

                        {/* Stats */}
                        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-white/10 pt-12">
                            {[
                                { value: '60%', label: 'Redução no volume de atendimentos com IA' },
                                { value: '< 2 min', label: 'Tempo médio de resposta após implantação' },
                                { value: '98%', label: 'Satisfação dos clientes (CSAT médio)' },
                                { value: '5 min', label: 'Para começar a atender após cadastro' },
                            ].map((stat) => (
                                <div key={stat.label} className="text-center">
                                    <div className="text-3xl md:text-4xl font-bold text-white">{stat.value}</div>
                                    <div className="mt-1 text-sm text-slate-400 leading-snug">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Funcionalidades ────────────────────────────────── */}
                <section id="funcionalidades" className="py-24 bg-slate-50">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-16">
                            <div className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Funcionalidades</div>
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Tudo que sua equipe precisa</h2>
                            <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
                                Do primeiro contato ao pós-venda, o KSZap cobre todo o ciclo de atendimento com ferramentas profissionais.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {features.map((f) => (
                                <div key={f.title} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 transition-all group">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                        {f.icon}
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed">{f.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Como funciona ──────────────────────────────────── */}
                <section className="py-24 bg-white">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-16">
                            <div className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Como funciona</div>
                            <h2 className="text-3xl md:text-4xl font-bold">Comece a atender em minutos</h2>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8">
                            {[
                                { step: '01', title: 'Conecte seu WhatsApp', desc: 'Escaneie o QR code e conecte quantos números quiser. Nenhuma configuração técnica necessária.' },
                                { step: '02', title: 'Convide seu time', desc: 'Adicione agentes, defina departamentos e configure permissões em poucos cliques.' },
                                { step: '03', title: 'Comece a atender', desc: 'Receba, distribua e responda mensagens com IA no painel unificado. Simples assim.' },
                            ].map((item) => (
                                <div key={item.step} className="relative pl-16">
                                    <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center">
                                        {item.step}
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Planos ─────────────────────────────────────────── */}
                <section id="planos" className="py-24 bg-slate-50">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-12">
                            <div className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Planos e Preços</div>
                            <h2 className="text-3xl md:text-4xl font-bold">Preço justo para cada etapa do crescimento</h2>
                            <p className="mt-4 text-slate-500 text-lg">14 dias grátis em todos os planos. Sem cartão de crédito.</p>

                            {/* Anual / Mensal toggle */}
                            <div className="mt-8 inline-flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                <button
                                    onClick={() => setAnnual(false)}
                                    className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${!annual ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Mensal
                                </button>
                                <button
                                    onClick={() => setAnnual(true)}
                                    className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${annual ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Anual
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${annual ? 'bg-indigo-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                        −15%
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-6 items-start">
                            {plans.map((plan) => (
                                <div
                                    key={plan.id}
                                    className={`relative rounded-2xl p-8 flex flex-col ${plan.highlight
                                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-600 shadow-2xl shadow-indigo-200 scale-[1.03]'
                                        : 'bg-white border border-slate-200 shadow-sm'
                                    }`}
                                >
                                    {plan.badge && (
                                        <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold tracking-wide ${plan.highlight ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}>
                                            {plan.badge}
                                        </div>
                                    )}

                                    <div className="mb-6">
                                        <div className={`text-xs font-semibold uppercase tracking-widest mb-1 ${plan.highlight ? 'text-indigo-200' : 'text-indigo-600'}`}>
                                            {plan.name}
                                        </div>
                                        <div className={`text-sm mb-4 ${plan.highlight ? 'text-indigo-100' : 'text-slate-500'}`}>{plan.tagline}</div>

                                        <div className="flex items-end gap-1">
                                            <span className={`text-4xl font-bold ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                                                R${annual ? plan.annualPrice : plan.monthlyPrice}
                                            </span>
                                            <span className={`text-sm mb-1 ${plan.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>/mês</span>
                                        </div>
                                        {annual && (
                                            <div className={`text-xs mt-1 ${plan.highlight ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                cobrado anualmente · economia de 15%
                                            </div>
                                        )}
                                    </div>

                                    <div className={`rounded-xl p-4 mb-6 text-sm ${plan.highlight ? 'bg-indigo-700/50' : 'bg-slate-50 border border-slate-100'}`}>
                                        <div className={`font-semibold mb-1 ${plan.highlight ? 'text-white' : 'text-slate-800'}`}>{plan.agentLimit}</div>
                                        <div className={plan.highlight ? 'text-indigo-200' : 'text-slate-500'}>{plan.extraAgent}</div>
                                        <div className={`mt-2 font-semibold ${plan.highlight ? 'text-white' : 'text-slate-800'}`}>{plan.whatsapp}</div>
                                    </div>

                                    <ul className="space-y-3 mb-8 flex-1">
                                        {plan.features.map((f) => (
                                            <li key={f.text} className="flex items-center gap-3 text-sm">
                                                {f.ok ? (
                                                    <svg className={`w-4 h-4 shrink-0 ${plan.highlight ? 'text-indigo-200' : 'text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                    </svg>
                                                ) : (
                                                    <svg className={`w-4 h-4 shrink-0 ${plan.highlight ? 'text-indigo-400/40' : 'text-slate-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                )}
                                                <span className={f.ok ? (plan.highlight ? 'text-white' : 'text-slate-700') : (plan.highlight ? 'text-indigo-300/50' : 'text-slate-300')}>
                                                    {f.text}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>

                                    <Link
                                        href="/login"
                                        className={`block text-center py-3 px-6 rounded-xl font-semibold text-sm transition-all ${plan.ctaStyle}`}
                                    >
                                        {plan.cta}
                                    </Link>
                                </div>
                            ))}
                        </div>

                        <p className="text-center text-sm text-slate-400 mt-10">
                            Precisa de um plano customizado? <a href="mailto:comercial@kszap.com.br" className="text-indigo-600 hover:underline font-medium">Fale com nosso time comercial</a>
                        </p>
                    </div>
                </section>

                {/* ── Comparativo ────────────────────────────────────── */}
                <section id="comparativo" className="py-24 bg-white">
                    <div className="max-w-5xl mx-auto px-6">
                        <div className="text-center mb-12">
                            <div className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Comparativo</div>
                            <h2 className="text-3xl md:text-4xl font-bold">Veja o que cada plano inclui</h2>
                        </div>

                        <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Funcionalidade</th>
                                        <th className="text-center px-4 py-4 text-slate-700 font-bold">Basic</th>
                                        <th className="text-center px-4 py-4 text-indigo-600 font-bold">Pro ★</th>
                                        <th className="text-center px-4 py-4 text-slate-700 font-bold">Enterprise</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisonRows.map((row, i) => (
                                        <tr key={row.feature} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                            <td className="px-6 py-3.5 text-slate-700 font-medium">{row.feature}</td>
                                            <td className="px-4 py-3.5 text-center"><TableCheck value={row.basic} /></td>
                                            <td className="px-4 py-3.5 text-center bg-indigo-50/40"><TableCheck value={row.pro} /></td>
                                            <td className="px-4 py-3.5 text-center"><TableCheck value={row.enterprise} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* ── Depoimentos ────────────────────────────────────── */}
                <section id="depoimentos" className="py-24 bg-slate-950 text-white">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-16">
                            <div className="text-sm font-semibold text-indigo-400 uppercase tracking-widest mb-3">Clientes</div>
                            <h2 className="text-3xl md:text-4xl font-bold">O que nossos clientes dizem</h2>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8">
                            {testimonials.map((t) => (
                                <div key={t.author} className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/8 transition-colors">
                                    <svg className="w-8 h-8 text-indigo-400 mb-4 opacity-60" fill="currentColor" viewBox="0 0 32 32">
                                        <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
                                    </svg>
                                    <p className="text-slate-200 leading-relaxed mb-6 text-sm">{t.quote}</p>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-sm font-bold`}>
                                            {t.initials}
                                        </div>
                                        <div>
                                            <div className="text-white font-semibold text-sm">{t.author}</div>
                                            <div className="text-slate-400 text-xs">{t.role} · {t.company}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── FAQ ────────────────────────────────────────────── */}
                <section className="py-24 bg-white">
                    <div className="max-w-3xl mx-auto px-6">
                        <div className="text-center mb-12">
                            <div className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">FAQ</div>
                            <h2 className="text-3xl font-bold">Perguntas frequentes</h2>
                        </div>
                        <div className="space-y-6">
                            {[
                                {
                                    q: 'Preciso de aprovação da Meta para usar?',
                                    a: 'Não. O KSZap usa conexão direta via QR code (Z-API), sem necessidade de conta Business no Facebook. Basta escanear e começar a usar.',
                                },
                                {
                                    q: 'Quantos agentes posso ter?',
                                    a: 'No Basic, 3 agentes incluídos (+R$79 cada). No Pro, 10 incluídos (+R$59 cada). No Enterprise, ilimitado. Você pode upgrade a qualquer momento.',
                                },
                                {
                                    q: 'A IA realmente funciona em português?',
                                    a: 'Sim. Nossa IA (baseada em AnythingLLM com modelos OpenAI) é treinada na sua base de conhecimento em português e responde naturalmente no idioma da conversa.',
                                },
                                {
                                    q: 'Meus dados ficam seguros?',
                                    a: 'Sim. Dados criptografados em repouso (AES-256), tráfego via HTTPS/TLS 1.3, tokens JWT com rotação automática e auditoria completa de ações.',
                                },
                                {
                                    q: 'Posso cancelar a qualquer momento?',
                                    a: 'Sim, sem multa ou carência. Planos mensais cancelados imediatamente. Planos anuais têm reembolso proporcional até 30 dias após a contratação.',
                                },
                            ].map((item) => (
                                <div key={item.q} className="border border-slate-200 rounded-xl p-6">
                                    <h3 className="font-semibold text-slate-900 mb-2">{item.q}</h3>
                                    <p className="text-slate-500 text-sm leading-relaxed">{item.a}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CTA Final ──────────────────────────────────────── */}
                <section className="py-24 bg-gradient-to-br from-indigo-600 to-violet-700 text-white">
                    <div className="max-w-3xl mx-auto px-6 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Pronto para transformar seu atendimento?</h2>
                        <p className="text-indigo-100 text-lg mb-10">
                            Comece agora com 14 dias grátis. Sem cartão de crédito. Cancele quando quiser.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/login"
                                className="px-8 py-4 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 font-bold text-base transition-all shadow-xl shadow-indigo-900/30"
                            >
                                Criar conta grátis
                            </Link>
                            <a
                                href="mailto:comercial@kszap.com.br"
                                className="px-8 py-4 rounded-xl border border-white/30 hover:border-white/60 text-white font-semibold text-base transition-all"
                            >
                                Falar com vendas
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            {/* ── Footer ─────────────────────────────────────────── */}
            <footer className="bg-slate-950 text-slate-400 py-12">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-8 mb-10">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                                    </svg>
                                </div>
                                <span className="font-bold text-white">KSZap</span>
                            </div>
                            <p className="text-sm leading-relaxed">Plataforma de atendimento multi-WhatsApp com IA para times que buscam excelência.</p>
                        </div>
                        <div>
                            <div className="text-white font-semibold text-sm mb-4">Produto</div>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a></li>
                                <li><a href="#planos" className="hover:text-white transition-colors">Planos</a></li>
                                <li><a href="#comparativo" className="hover:text-white transition-colors">Comparativo</a></li>
                                <li><Link href="/login" className="hover:text-white transition-colors">Entrar</Link></li>
                            </ul>
                        </div>
                        <div>
                            <div className="text-white font-semibold text-sm mb-4">Empresa</div>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#depoimentos" className="hover:text-white transition-colors">Clientes</a></li>
                                <li><a href="mailto:comercial@kszap.com.br" className="hover:text-white transition-colors">Comercial</a></li>
                                <li><a href="mailto:suporte@kszap.com.br" className="hover:text-white transition-colors">Suporte</a></li>
                            </ul>
                        </div>
                        <div>
                            <div className="text-white font-semibold text-sm mb-4">Legal</div>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-white transition-colors">Termos de Uso</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Privacidade (LGPD)</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Política de Cookies</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
                        <p>© {new Date().getFullYear()} KSZap. Todos os direitos reservados.</p>
                        <p>Feito com dedicação para times de atendimento brasileiros.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
