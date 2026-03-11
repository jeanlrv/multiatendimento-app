'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface Message {
    role: 'user' | 'assistant'
    content: string
    ts?: number
}

interface EmbedConfig {
    brandColor: string
    brandLogo: string | null
    agentName: string
    welcomeMsg: string | null
    placeholder: string
    position: string
}

// Escape HTML antes de aplicar formatação para prevenir XSS
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

// Formata texto estilo WhatsApp: *bold*, _italic_, `code`, ```block```
function formatMessage(raw: string): string {
    let t = escapeHtml(raw)
    t = t.replace(/```([\s\S]*?)```/g, '<pre style="background:#f3f4f6;padding:8px 10px;border-radius:6px;font-size:11px;overflow-x:auto;margin:4px 0;font-family:monospace;white-space:pre-wrap">$1</pre>')
    t = t.replace(/`([^`\n]+)`/g, '<code style="background:#f0f0f0;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:0.9em">$1</code>')
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    t = t.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    t = t.replace(/_([^_\n]+)_/g, '<em>$1</em>')
    t = t.replace(/~([^~\n]+)~/g, '<del>$1</del>')
    t = t.replace(/\n/g, '<br>')
    return t
}

function AgentAvatar({ logo, name, color, size }: { logo: string | null; name: string; color: string; size: number }) {
    const [imgError, setImgError] = useState(false)
    if (logo && !imgError) {
        return (
            <img
                src={logo}
                alt={name}
                onError={() => setImgError(true)}
                style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }}
            />
        )
    }
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', backgroundColor: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: Math.round(size * 0.4), flexShrink: 0
        }}>
            {name[0]?.toUpperCase() ?? '?'}
        </div>
    )
}

export default function EmbedChatPage() {
    const params = useParams()
    const embedId = params.embedId as string

    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isStreaming, setIsStreaming] = useState(false)
    const [config, setConfig] = useState<EmbedConfig | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [attachedFile, setAttachedFile] = useState<File | null>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Determine API URL — priority: ?api= query param > build-time env vars
    const buildTimeApiUrl = (
        process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL ||
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:3002'
    ).replace(/\/api\/?$/, '') + '/api'
    const [apiUrl, setApiUrl] = useState(buildTimeApiUrl)

    // Lê ?api= do query string (injetado pelo embed script) na montagem
    useEffect(() => {
        const p = new URLSearchParams(window.location.search)
        const apiParam = p.get('api')
        if (apiParam && apiParam.startsWith('http')) {
            setApiUrl(apiParam.replace(/\/api\/?$/, '') + '/api')
        }
    }, [])

    // Inicializa sessão e busca config; re-executa quando apiUrl muda (URL correta injetada)
    useEffect(() => {
        if (!embedId) return

        // Limpa estados anteriores ao re-tentar com nova URL
        setError(null)
        setConfig(null)

        let sid = localStorage.getItem(`kszap_session_${embedId}`)
        if (!sid) {
            sid = crypto.randomUUID()
            localStorage.setItem(`kszap_session_${embedId}`, sid)
        }
        setSessionId(sid)

        fetch(`${apiUrl}/embed/${embedId}`)
            .then(res => {
                if (!res.ok) throw new Error('Agente não encontrado ou inativo.')
                return res.json()
            })
            .then(data => setConfig(data))
            .catch(err => setError(err.message))

        fetch(`${apiUrl}/embed/${embedId}/history/${sid}`)
            .then(res => res.json())
            .then(data => { if (data.messages?.length > 0) setMessages(data.messages) })
            .catch(() => { /* histórico vazio — ignorar */ })
    }, [embedId, apiUrl])

    // Auto-scroll ao fim
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isLoading])

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`
        }
    }, [inputValue])

    const handleSend = useCallback(async () => {
        if ((!inputValue.trim() && !attachedFile) || isLoading || !sessionId) return

        const file = attachedFile
        const displayContent = file ? `📎 ${file.name}${inputValue.trim() ? '\n' + inputValue.trim() : ''}` : inputValue.trim()
        const userMsg: Message = { role: 'user', content: displayContent, ts: Date.now() }
        setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', ts: Date.now() }])
        setInputValue('')
        setAttachedFile(null)
        setIsLoading(true)
        setIsStreaming(false)

        // Com arquivo: usa endpoint síncrono (sem streaming)
        if (file) {
            try {
                const fd = new FormData()
                fd.append('file', file)
                fd.append('message', inputValue.trim())
                fd.append('sessionId', sessionId)
                const res = await fetch(`${apiUrl}/embed/${embedId}/chat-with-attachment`, { method: 'POST', body: fd })
                const data = await res.json()
                if (!res.ok) throw new Error(data.message || 'Erro ao processar arquivo.')
                setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { role: 'assistant', content: data.response, ts: Date.now() }
                    return updated
                })
            } catch (err: any) {
                setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { role: 'assistant', content: `Desculpe, ocorreu um erro: ${err.message}`, ts: Date.now() }
                    return updated
                })
            } finally {
                setIsLoading(false)
                setIsStreaming(false)
            }
            return
        }

        // Sem arquivo: streaming normal
        try {
            const res = await fetch(`${apiUrl}/embed/${embedId}/chat-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, message: userMsg.content })
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.message || 'Erro ao enviar mensagem.')
            }

            const reader = res.body!.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop()!
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const event = JSON.parse(line.slice(6))
                        if (event.type === 'chunk') {
                            setIsStreaming(true) // esconde dots assim que primeiro token chega
                            setMessages(prev => {
                                const updated = [...prev]
                                const last = updated[updated.length - 1]
                                updated[updated.length - 1] = { ...last, content: last.content + event.content }
                                return updated
                            })
                        } else if (event.type === 'error') {
                            throw new Error(event.message || 'Erro no servidor.')
                        }
                    } catch (parseErr: any) {
                        if (parseErr.message?.includes('Erro')) throw parseErr
                    }
                }
            }
        } catch (err: any) {
            setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                    role: 'assistant',
                    content: `Desculpe, ocorreu um erro: ${err.message}`,
                    ts: Date.now()
                }
                return updated
            })
        } finally {
            setIsLoading(false)
            setIsStreaming(false)
        }
    }, [inputValue, attachedFile, isLoading, sessionId, embedId, apiUrl])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleClose = () => {
        window.parent?.postMessage('KSZAP_CLOSE_EMBED', '*')
    }

    const handleClearChat = () => {
        const sid = crypto.randomUUID()
        localStorage.setItem(`kszap_session_${embedId}`, sid)
        setSessionId(sid)
        setMessages([])
    }

    if (error) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f9fafb', padding: 24, textAlign: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#374151', margin: 0 }}>{error}</p>
            </div>
        )
    }

    if (!config) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'transparent' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#6366f1', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'white', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

            {/* ── Header ─────────────────────────────────────────── */}
            <header style={{
                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                background: config.brandColor, color: 'white', flexShrink: 0,
                boxShadow: '0 1px 6px rgba(0,0,0,0.18)'
            }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <AgentAvatar logo={config.brandLogo} name={config.agentName} color="rgba(255,255,255,0.25)" size={40} />
                    <div style={{
                        position: 'absolute', bottom: 1, right: 1, width: 10, height: 10,
                        borderRadius: '50%', background: '#4ade80', border: '2px solid white'
                    }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {config.agentName}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.75, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>
                        Online
                    </div>
                </div>

                {/* Botão limpar conversa */}
                {messages.length > 0 && (
                    <button
                        onClick={handleClearChat}
                        aria-label="Nova conversa"
                        title="Nova conversa"
                        style={{
                            background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
                            width: 30, height: 30, cursor: 'pointer', color: 'white', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 1 10 7 10"></polyline>
                            <path d="M3.51 15a9 9 0 1 0 .49-3.51"></path>
                        </svg>
                    </button>
                )}

                {/* Botão fechar */}
                <button
                    onClick={handleClose}
                    aria-label="Fechar chat"
                    style={{
                        background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
                        width: 30, height: 30, cursor: 'pointer', color: 'white', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </header>

            {/* ── Área de mensagens ───────────────────────────────── */}
            <div
                ref={scrollRef}
                style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10, background: '#f8f9fb' }}
            >
                {/* Mensagem de boas-vindas */}
                {config.welcomeMsg && messages.length === 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <AgentAvatar logo={config.brandLogo} name={config.agentName} color={config.brandColor} size={28} />
                        <div style={{
                            background: 'white', color: '#374151', padding: '10px 13px',
                            borderRadius: '16px 16px 16px 4px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            border: '1px solid #eef0f2', fontSize: 13, lineHeight: 1.55,
                            maxWidth: '83%', wordBreak: 'break-word'
                        }}>
                            {config.welcomeMsg}
                        </div>
                    </div>
                )}

                {/* Mensagens */}
                {messages.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                        {msg.role === 'assistant' && (
                            <AgentAvatar logo={config.brandLogo} name={config.agentName} color={config.brandColor} size={28} />
                        )}
                        {msg.role === 'assistant' ? (
                            // Assistente: HTML formatado (já escapado)
                            <div
                                style={{
                                    padding: '10px 13px', fontSize: 13, lineHeight: 1.6,
                                    maxWidth: '83%', wordBreak: 'break-word',
                                    borderRadius: '16px 16px 16px 4px',
                                    background: 'white', color: '#374151',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eef0f2',
                                    minHeight: msg.content === '' ? 20 : undefined,
                                }}
                                dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                            />
                        ) : (
                            // Usuário: texto puro
                            <div style={{
                                padding: '10px 13px', fontSize: 13, lineHeight: 1.55,
                                maxWidth: '83%', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                borderRadius: '16px 16px 4px 16px',
                                background: config.brandColor, color: 'white',
                                boxShadow: `0 2px 8px ${config.brandColor}40`
                            }}>
                                {msg.content}
                            </div>
                        )}
                    </div>
                ))}

                {/* Indicador de digitação — só exibe antes do primeiro token */}
                {isLoading && !isStreaming && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <AgentAvatar logo={config.brandLogo} name={config.agentName} color={config.brandColor} size={28} />
                        <div style={{
                            background: 'white', padding: '12px 14px', borderRadius: '16px 16px 16px 4px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eef0f2',
                            display: 'flex', gap: 4, alignItems: 'center'
                        }}>
                            {[0, 150, 300].map(delay => (
                                <div key={delay} style={{
                                    width: 7, height: 7, borderRadius: '50%', background: '#9ca3af',
                                    animation: 'bounce 1.1s ease-in-out infinite', animationDelay: `${delay}ms`
                                }} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Área de input ───────────────────────────────────── */}
            <footer style={{ padding: '8px 10px 10px', background: 'white', borderTop: '1px solid #eef0f2', flexShrink: 0 }}>
                {/* Preview do arquivo anexado */}
                {attachedFile && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
                        padding: '4px 10px', background: '#f0f4ff', borderRadius: 10,
                        border: `1px solid ${config.brandColor}33`, fontSize: 11
                    }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={config.brandColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151', fontWeight: 600 }}>
                            {attachedFile.name}
                        </span>
                        <span style={{ color: '#9ca3af', flexShrink: 0 }}>({(attachedFile.size / 1024).toFixed(0)} KB)</span>
                        <button
                            type="button"
                            onClick={() => setAttachedFile(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af', flexShrink: 0, lineHeight: 0 }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                )}
                {/* Input oculto para seleção de arquivo */}
                <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    accept=".pdf,.docx,.xlsx,.xls,.txt,.xml,.csv,.json,.png,.jpg,.jpeg,.gif,.webp"
                    onChange={e => { if (e.target.files?.[0]) setAttachedFile(e.target.files[0]); e.currentTarget.value = '' }}
                />
                <form
                    onSubmit={e => { e.preventDefault(); handleSend() }}
                    style={{
                        display: 'flex', alignItems: 'flex-end', gap: 6,
                        background: '#f3f4f6', borderRadius: 20, padding: '6px 8px 6px 10px',
                        border: `1.5px solid transparent`, transition: 'border-color 0.2s'
                    }}
                    onFocusCapture={e => {
                        const form = e.currentTarget
                        form.style.borderColor = config.brandColor + '55'
                        form.style.background = 'white'
                    }}
                    onBlurCapture={e => {
                        const form = e.currentTarget
                        form.style.borderColor = 'transparent'
                        form.style.background = '#f3f4f6'
                    }}
                >
                    {/* Botão anexar arquivo */}
                    <button
                        type="button"
                        title="Anexar arquivo (PDF, DOCX, XLSX, XML, TXT, imagens — máx 10 MB)"
                        disabled={isLoading}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            background: 'none', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                            padding: 4, color: attachedFile ? config.brandColor : '#9ca3af',
                            flexShrink: 0, lineHeight: 0, opacity: isLoading ? 0.5 : 1,
                            transition: 'color 0.2s'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                    </button>
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={attachedFile ? 'Adicione uma mensagem (opcional)...' : (config.placeholder || 'Digite sua mensagem...')}
                        disabled={isLoading}
                        rows={1}
                        style={{
                            flex: 1, background: 'transparent', border: 'none', outline: 'none',
                            fontSize: 13, color: '#374151', resize: 'none', lineHeight: 1.55,
                            padding: '2px 0', maxHeight: 96, fontFamily: 'inherit',
                            overflowY: 'auto', scrollbarWidth: 'none'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || (!inputValue.trim() && !attachedFile)}
                        style={{
                            width: 32, height: 32, borderRadius: '50%', border: 'none', flexShrink: 0,
                            background: (inputValue.trim() || attachedFile) && !isLoading ? config.brandColor : '#d1d5db',
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: (inputValue.trim() || attachedFile) && !isLoading ? 'pointer' : 'not-allowed',
                            transition: 'background 0.2s, transform 0.1s',
                        }}
                        onMouseDown={e => { if (inputValue.trim() || attachedFile) e.currentTarget.style.transform = 'scale(0.9)' }}
                        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </form>
                <p style={{ textAlign: 'center', marginTop: 6, fontSize: 10, color: '#c0c4cc', marginBottom: 0 }}>
                    Powered by{' '}
                    <a href="https://kszap.com" target="_blank" rel="noopener noreferrer"
                        style={{ fontWeight: 700, color: '#b0b4bc', textDecoration: 'none' }}>
                        KSZap
                    </a>
                </p>
            </footer>

            <style>{`
                @keyframes bounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-5px); }
                }
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }
                * { box-sizing: border-box; }
                strong { font-weight: 700; }
                em { font-style: italic; opacity: 0.9; }
                del { opacity: 0.7; }
            `}</style>
        </div>
    )
}
