import { AIAgent } from '@/services/ai-agents'
import { motion } from 'framer-motion'
import { Copy, Check, Palette, Type, Layout, ExternalLink, AlertCircle, Globe, Shield } from 'lucide-react'
import { useState } from 'react'

interface WidgetConfigTabProps {
    agent: Partial<AIAgent>
    onChange: (data: Partial<AIAgent>) => void
}

const POSITION_OPTIONS = [
    { value: 'bottom-right', label: 'Direita', icon: '↘' },
    { value: 'bottom-left', label: 'Esquerda', icon: '↙' },
]

export default function WidgetConfigTab({ agent, onChange }: WidgetConfigTabProps) {
    const [copied, setCopied] = useState(false)
    const [hexInput, setHexInput] = useState(agent.embedBrandColor || '#4F46E5')
    const [logoError, setLogoError] = useState(false)

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'
    const frontendUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const isAgentSaved = !!agent.id && !!agent.embedId

    const embedScript = isAgentSaved
        ? `<script src="${backendUrl}/embed/${agent.embedId}/script.js" defer></script>`
        : ''

    const brandColor = agent.embedBrandColor || '#4F46E5'
    const agentName = agent.embedAgentName || agent.name || 'Assistente'
    const logoUrl = agent.embedBrandLogo || ''

    const copyToClipboard = () => {
        if (!isAgentSaved) return
        navigator.clipboard.writeText(embedScript)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleHexChange = (value: string) => {
        setHexInput(value)
        if (/^#[0-9a-fA-F]{6}$/.test(value)) {
            onChange({ embedBrandColor: value })
        }
    }

    const handleLogoChange = (value: string) => {
        setLogoError(false)
        onChange({ embedBrandLogo: value })
    }

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-7 pb-8">

            {/* Toggle + Script */}
            <div className="bg-primary/5 p-5 rounded-[2rem] border border-primary/10">
                <div className="flex items-center gap-4 mb-1">
                    <div
                        className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all ${agent.embedEnabled ? 'bg-primary' : 'bg-slate-300'}`}
                        onClick={() => onChange({ embedEnabled: !agent.embedEnabled })}
                    >
                        <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-sm ${agent.embedEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Widget Chat Ativado</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Torne este agente disponível no seu site</p>
                    </div>
                </div>

                {agent.embedEnabled && (
                    <div className="mt-5 space-y-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Script de Incorporação</label>
                        {!isAgentSaved ? (
                            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600/30 rounded-2xl text-xs font-bold text-amber-700 dark:text-amber-300">
                                <AlertCircle size={16} /> Salve o agente primeiro para gerar o script.
                            </div>
                        ) : (
                            <div className="relative group">
                                <pre className="bg-slate-950 text-slate-300 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto border border-white/10 leading-relaxed">
                                    {embedScript}
                                </pre>
                                <button
                                    type="button"
                                    onClick={copyToClipboard}
                                    className="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white border border-white/10"
                                >
                                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                </button>
                            </div>
                        )}
                        <p className="text-[10px] text-slate-400 italic">Cole este código antes da tag &lt;/body&gt; do seu site.</p>
                    </div>
                )}
            </div>

            {/* Visual & Avatar */}
            <div className="space-y-5">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Palette size={14} className="text-primary" /> Visual & Identidade
                </h4>

                {/* Avatar / Logo preview + inputs */}
                <div className="flex gap-5 items-start">
                    {/* Preview circular do avatar */}
                    <div className="shrink-0">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 block mb-2">Avatar</label>
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden border-2"
                            style={{ borderColor: brandColor + '40', backgroundColor: logoError || !logoUrl ? brandColor : 'transparent' }}
                        >
                            {logoUrl && !logoError ? (
                                <img
                                    src={logoUrl}
                                    alt="Logo preview"
                                    className="w-full h-full object-cover"
                                    onError={() => setLogoError(true)}
                                    onLoad={() => setLogoError(false)}
                                />
                            ) : (
                                <span className="text-white font-bold text-2xl select-none">
                                    {agentName[0]?.toUpperCase() ?? '?'}
                                </span>
                            )}
                        </div>
                        <p className="text-[9px] text-slate-400 text-center mt-1">Pré-visualização</p>
                    </div>

                    {/* Campos à direita */}
                    <div className="flex-1 space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">URL da Foto de Perfil / Logo</label>
                            <input
                                value={agent.embedBrandLogo || ''}
                                onChange={(e) => handleLogoChange(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:border-primary/40 transition-colors"
                                placeholder="https://sua-empresa.com/logo.png"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome de Exibição</label>
                            <input
                                value={agent.embedAgentName || ''}
                                onChange={(e) => onChange({ embedAgentName: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:border-primary/40 transition-colors"
                                placeholder={agent.name || 'Assistente Virtual'}
                            />
                        </div>
                    </div>
                </div>

                {/* Cor principal */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cor Principal</label>
                    <div className="flex gap-3 items-center">
                        <input
                            type="color"
                            value={agent.embedBrandColor || '#4F46E5'}
                            onChange={(e) => { onChange({ embedBrandColor: e.target.value }); setHexInput(e.target.value) }}
                            className="h-10 w-16 rounded-xl cursor-pointer bg-transparent border border-slate-200 dark:border-white/10 p-1"
                        />
                        <input
                            type="text"
                            value={hexInput}
                            onChange={(e) => handleHexChange(e.target.value)}
                            maxLength={7}
                            className="w-32 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none focus:border-primary/40 transition-colors"
                            placeholder="#4F46E5"
                        />
                        {/* Paleta de cores rápidas */}
                        <div className="flex gap-1.5 flex-wrap">
                            {['#4F46E5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#374151'].map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => { onChange({ embedBrandColor: c }); setHexInput(c) }}
                                    title={c}
                                    className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 active:scale-95"
                                    style={{ backgroundColor: c, borderColor: brandColor === c ? 'white' : 'transparent', outline: brandColor === c ? `2px solid ${c}` : 'none' }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Textos & Mensagens */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Type size={14} className="text-primary" /> Mensagens & Textos
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mensagem de Boas-vindas</label>
                        <textarea
                            value={agent.embedWelcomeMsg || ''}
                            onChange={(e) => onChange({ embedWelcomeMsg: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none h-20 resize-none focus:border-primary/40 transition-colors"
                            placeholder="Olá! Como posso te ajudar hoje? 😊"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Placeholder do Input</label>
                        <input
                            value={agent.embedPlaceholder || ''}
                            onChange={(e) => onChange({ embedPlaceholder: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:border-primary/40 transition-colors"
                            placeholder="Digite sua mensagem..."
                        />
                    </div>
                </div>
            </div>

            {/* Posição do Widget */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Layout size={14} className="text-primary" /> Posição do Widget
                </h4>
                <div className="flex gap-3">
                    {POSITION_OPTIONS.map(opt => {
                        const isSelected = (agent.embedPosition || 'bottom-right') === opt.value
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => onChange({ embedPosition: opt.value })}
                                className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all cursor-pointer ${isSelected
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-slate-200 dark:border-white/10 text-slate-400 hover:border-primary/30'
                                    }`}
                            >
                                {/* Mini mockup da posição */}
                                <div className="w-16 h-10 rounded-lg bg-slate-100 dark:bg-white/10 relative border border-slate-200 dark:border-white/10 overflow-hidden">
                                    <div className={`absolute bottom-1 w-4 h-4 rounded-full ${isSelected ? 'bg-primary' : 'bg-slate-400'} ${opt.value === 'bottom-right' ? 'right-1' : 'left-1'}`} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest">{opt.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Segurança */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Shield size={14} className="text-primary" /> Segurança
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Domínios Autorizados</label>
                        <input
                            value={agent.embedAllowedDomains?.join(', ') || ''}
                            onChange={(e) => onChange({ embedAllowedDomains: e.target.value.split(',').map(d => d.trim()).filter(Boolean) })}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:border-primary/40 transition-colors"
                            placeholder="exemplo.com, app.exemplo.com"
                        />
                        <p className="text-[9px] text-slate-400 italic ml-1">Deixe em branco para permitir todos os domínios.</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Limite de Mensagens / 10 min</label>
                        <input
                            type="number"
                            value={agent.embedRateLimit ?? 20}
                            onChange={(e) => onChange({ embedRateLimit: parseInt(e.target.value) || 20 })}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:border-primary/40 transition-colors"
                            min="1"
                            max="200"
                        />
                        <p className="text-[9px] text-slate-400 italic ml-1">Máximo de mensagens por sessão a cada 10 minutos.</p>
                    </div>
                </div>
            </div>

            {/* Pré-visualização + Link */}
            {isAgentSaved ? (
                <div className="pt-2 space-y-3">
                    {/* Mini preview do widget */}
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                        {/* Header do preview */}
                        <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: brandColor }}>
                            <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0"
                                style={{ background: logoError || !logoUrl ? 'rgba(255,255,255,0.25)' : 'transparent' }}>
                                {logoUrl && !logoError
                                    ? <img src={logoUrl} alt="" className="w-full h-full object-cover" onError={() => setLogoError(true)} />
                                    : <span className="text-white font-bold text-sm">{agentName[0]?.toUpperCase()}</span>
                                }
                            </div>
                            <div>
                                <div className="text-white text-xs font-semibold leading-tight">{agentName}</div>
                                <div className="text-white/70 text-[9px] uppercase tracking-wider font-medium">Online</div>
                            </div>
                        </div>
                        {/* Corpo do preview */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/40 space-y-2">
                            {agent.embedWelcomeMsg && (
                                <div className="flex gap-1.5 items-end">
                                    <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                                        style={{ background: logoError || !logoUrl ? brandColor : 'transparent' }}>
                                        {logoUrl && !logoError
                                            ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                                            : <span className="text-white font-bold" style={{ fontSize: 8 }}>{agentName[0]?.toUpperCase()}</span>
                                        }
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 rounded-xl rounded-bl-sm px-2.5 py-1.5 text-[10px] text-slate-600 dark:text-slate-300 max-w-[80%] border border-slate-100 dark:border-white/10">
                                        {agent.embedWelcomeMsg.substring(0, 60)}{agent.embedWelcomeMsg.length > 60 ? '...' : ''}
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end">
                                <div className="px-2.5 py-1.5 rounded-xl rounded-br-sm text-[10px] text-white max-w-[60%]" style={{ backgroundColor: brandColor }}>
                                    Olá! Tenho uma dúvida 👋
                                </div>
                            </div>
                        </div>
                        {/* Footer input do preview */}
                        <div className="px-3 py-2 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-white/5 rounded-full h-6 px-3 flex items-center">
                                <span className="text-[9px] text-slate-400">{agent.embedPlaceholder || 'Digite sua mensagem...'}</span>
                            </div>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: brandColor }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <a
                        href={`/embed/${agent.embedId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 dark:bg-white/5 hover:bg-primary/10 hover:text-primary rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                    >
                        <ExternalLink size={14} /> Abrir Visualização Completa
                    </a>
                </div>
            ) : (
                <div className="pt-2">
                    <div className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 cursor-not-allowed opacity-50">
                        <ExternalLink size={14} /> Salve o agente para visualizar
                    </div>
                </div>
            )}
        </motion.div>
    )
}
