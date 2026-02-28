import { AIAgent } from '@/services/ai-agents'
import { motion } from 'framer-motion'
import { Copy, Check, Palette, Type, Layout, ExternalLink, AlertCircle } from 'lucide-react'
import { useState } from 'react'

interface WidgetConfigTabProps {
    agent: Partial<AIAgent>
    onChange: (data: Partial<AIAgent>) => void
}

export default function WidgetConfigTab({ agent, onChange }: WidgetConfigTabProps) {
    const [copied, setCopied] = useState(false)
    const [hexInput, setHexInput] = useState(agent.embedBrandColor || '#4F46E5')
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'
    const isAgentSaved = !!agent.id && !!agent.embedId

    const embedScript = isAgentSaved ? `<script
  src="${backendUrl}/embed/${agent.embedId}/script.js"
  defer
></script>` : ''

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

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8 pb-8">
            <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/10">
                <div className="flex items-center gap-4 mb-4">
                    <div className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-all ${agent.embedEnabled ? 'bg-primary' : 'bg-slate-300'}`}
                        onClick={() => onChange({ embedEnabled: !agent.embedEnabled })}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-all ${agent.embedEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Widget Chat Ativado</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Torne este agente disponível no seu site</p>
                    </div>
                </div>

                {agent.embedEnabled && (
                    <div className="mt-6 space-y-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Script de Incorporação (Embed)</label>
                        {!isAgentSaved ? (
                            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600/30 rounded-2xl text-xs font-bold text-amber-700 dark:text-amber-300">
                                <AlertCircle size={16} /> Salve o agente primeiro para gerar o script de incorporação.
                            </div>
                        ) : (
                            <div className="relative group">
                                <pre className="bg-slate-950 text-slate-300 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto border border-white/10">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Palette size={14} className="text-primary" /> Visual & Marca
                    </h4>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cor Principal</label>
                        <div className="flex gap-3">
                            <input
                                type="color"
                                value={agent.embedBrandColor || '#4F46E5'}
                                onChange={(e) => { onChange({ embedBrandColor: e.target.value }); setHexInput(e.target.value) }}
                                className="h-10 w-20 rounded-xl cursor-pointer bg-transparent border-none"
                            />
                            <input
                                type="text"
                                value={hexInput}
                                onChange={(e) => handleHexChange(e.target.value)}
                                maxLength={7}
                                className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-mono font-bold"
                                placeholder="#4F46E5"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Logo do Widget (URL)</label>
                        <input
                            value={agent.embedBrandLogo || ''}
                            onChange={(e) => onChange({ embedBrandLogo: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none"
                            placeholder="https://sua-empresa.com/logo.png"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome de Exibição</label>
                        <input
                            value={agent.embedAgentName || ''}
                            onChange={(e) => onChange({ embedAgentName: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none"
                            placeholder={agent.name || 'Assistente Virtual'}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Type size={14} className="text-primary" /> Mensagens
                    </h4>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mensagem de Boas-vindas</label>
                        <textarea
                            value={agent.embedWelcomeMsg || ''}
                            onChange={(e) => onChange({ embedWelcomeMsg: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none h-20 resize-none"
                            placeholder="Olá! Como posso te ajudar hoje?"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Placeholder do Input</label>
                        <input
                            value={agent.embedPlaceholder || ''}
                            onChange={(e) => onChange({ embedPlaceholder: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none"
                            placeholder="Digite sua mensagem..."
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Layout size={14} className="text-primary" /> Configurações de Segurança
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Domínios Autorizados</label>
                        <input
                            value={agent.embedAllowedDomains?.join(', ') || ''}
                            onChange={(e) => onChange({ embedAllowedDomains: e.target.value.split(',').map(d => d.trim()).filter(Boolean) })}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none"
                            placeholder="exemplo.com, app.exemplo.com"
                        />
                        <p className="text-[9px] text-slate-400 italic">Deixe em branco para permitir todos os domínios.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Limite de Mensagens/Sessão (Rate Limit)</label>
                        <input
                            type="number"
                            value={agent.embedRateLimit || 10}
                            onChange={(e) => onChange({ embedRateLimit: parseInt(e.target.value) || 10 })}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none"
                            min="1"
                        />
                        <p className="text-[9px] text-slate-400 italic">Número máximo de mensagens por sessão a cada 10 minutos.</p>
                    </div>
                </div>
            </div>

            <div className="pt-4">
                {isAgentSaved ? (
                    <a
                        href={`/embed/${agent.embedId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 dark:bg-white/5 hover:bg-primary/10 hover:text-primary rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                    >
                        <ExternalLink size={14} /> Visualizar Widget em Tela Cheia
                    </a>
                ) : (
                    <div className="flex items-center justify-center gap-2 w-full py-3 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 cursor-not-allowed opacity-50">
                        <ExternalLink size={14} /> Salve o agente para visualizar
                    </div>
                )}
            </div>
        </motion.div>
    )
}
