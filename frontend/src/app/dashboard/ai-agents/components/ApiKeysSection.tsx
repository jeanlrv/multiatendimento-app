import { AIAgentsService } from '@/services/ai-agents'
import { Key, Plus, Trash2, Copy, Check, Info, AlertCircle, RefreshCcw } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface ApiKey {
    id: string
    name: string
    keyPrefix: string
    lastUsedAt: string | null
    createdAt: string
    agent?: { name: string }
    token?: string
}

interface ApiKeysSectionProps {
    agentId?: string
}

export default function ApiKeysSection({ agentId }: ApiKeysSectionProps) {
    const [keys, setKeys] = useState<ApiKey[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [newName, setNewName] = useState('')
    const [newKey, setNewKey] = useState<ApiKey | null>(null)
    const [copied, setCopied] = useState(false)

    const fetchKeys = async () => {
        try {
            setLoading(true)
            const data = await AIAgentsService.listApiKeys()
            setKeys(data)
        } catch (error) {
            console.error('Erro ao buscar API Keys:', error)
            toast.error('Erro ao carregar API Keys')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchKeys()
    }, [agentId])

    const handleCreate = async () => {
        if (!newName) return
        try {
            setCreating(true)
            const key = await AIAgentsService.createApiKey({
                name: newName,
                agentId: agentId
            })
            setNewKey(key)
            setNewName('')
            fetchKeys()
            toast.success('API Key gerada com sucesso')
        } catch (error) {
            console.error('Erro ao criar API Key:', error)
            toast.error('Erro ao gerar API Key')
        } finally {
            setCreating(false)
        }
    }

    const handleRevoke = (id: string) => {
        toast('Revogar esta chave? O acesso será interrompido imediatamente.', {
            action: { label: 'Revogar', onClick: async () => {
                try {
                    await AIAgentsService.revokeApiKey(id)
                    fetchKeys()
                    toast.success('API Key revogada')
                } catch (error) {
                    console.error('Erro ao revogar API Key:', error)
                    toast.error('Erro ao revogar API Key')
                }
            }},
            cancel: { label: 'Cancelar', onClick: () => {} },
            duration: 5000,
        })
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
            <div className="flex flex-col gap-6">
                <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] border border-slate-200 dark:border-white/10">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Plus size={14} className="text-primary" /> Gerar Nova API Key
                    </h4>
                    <div className="flex gap-3">
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Nome identificador (ex: App Mobile)"
                            className="flex-1 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-semibold outline-none"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={creating || !newName}
                            className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                        >
                            {creating ? <RefreshCcw size={16} className="animate-spin" /> : 'Gerar'}
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {newKey && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-600/30 p-6 rounded-[2rem] relative overflow-hidden"
                        >
                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-2 bg-amber-100 dark:bg-amber-600/20 rounded-lg text-amber-600">
                                    <AlertCircle size={20} />
                                </div>
                                <div className="flex-1">
                                    <h5 className="text-sm font-bold text-amber-900 dark:text-amber-200 uppercase tracking-tight">Chave Gerada com Sucesso!</h5>
                                    <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 mt-1 uppercase tracking-widest">⚠️ Copie agora. Por segurança, ela não será exibida novamente.</p>
                                </div>
                                <button onClick={() => setNewKey(null)} className="text-amber-400 hover:text-amber-600">
                                    <Check size={20} />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 bg-white dark:bg-black/20 p-4 rounded-xl border border-amber-200 dark:border-amber-600/20">
                                <code className="flex-1 text-sm font-mono font-bold text-slate-800 dark:text-slate-200 truncate">{newKey.token}</code>
                                <button
                                    onClick={() => copyToClipboard(newKey.token!)}
                                    className="p-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 rounded-lg transition-all"
                                >
                                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Key size={14} className="text-primary" /> Chaves Ativas
                        </h4>
                        <button onClick={fetchKeys} className="p-2 text-slate-400 hover:text-primary transition-colors">
                            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            [1, 2].map(i => <div key={i} className="h-20 bg-slate-50 dark:bg-white/5 rounded-2xl animate-pulse" />)
                        ) : keys.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-dashed border-slate-200 dark:border-white/10">
                                <Key className="mx-auto mb-4 text-slate-300" size={32} />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhuma API Key ativa.</p>
                            </div>
                        ) : (
                            keys.map(key => (
                                <div
                                    key={key.id}
                                    className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 py-4 px-6 rounded-2xl flex items-center justify-between group hover:shadow-lg transition-all"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <h5 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">{key.name}</h5>
                                            {key.agent && (
                                                <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                                    Agente: {key.agent.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-1">
                                            <p className="font-mono text-[10px] text-slate-400">{key.keyPrefix}******************</p>
                                            <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                <Info size={10} /> {key.lastUsedAt ? `Usada ${new Date(key.lastUsedAt).toLocaleDateString()}` : 'Nunca usada'}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRevoke(key.id)}
                                        className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                <h5 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Info size={16} className="text-primary" /> Como usar
                </h5>
                <p className="text-[11px] leading-relaxed opacity-70 mb-4">
                    Envie a chave no header <code className="bg-white/10 px-2 py-0.5 rounded text-primary">X-API-Key</code> para autenticar suas chamadas.
                </p>
                <pre className="bg-black/30 p-4 rounded-xl text-[10px] font-mono overflow-x-auto text-primary/80">
                    {`curl -X POST "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'}/ai/agents/${agentId || 'ID_DO_AGENTE'}/chat-public" \\
  -H "X-API-Key: kszap_..." \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Olá!"}'`}
                </pre>
            </div>
        </motion.div>
    )
}
