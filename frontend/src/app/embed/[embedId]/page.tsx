'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

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

export default function EmbedChatPage() {
    const params = useParams()
    const embedId = params.embedId as string

    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [config, setConfig] = useState<EmbedConfig | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [sessionId, setSessionId] = useState<string | null>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api'

    // Initialize session and config
    useEffect(() => {
        if (!embedId) return

        // 1. Session ID (localStorage)
        let sid = localStorage.getItem(`kszap_session_${embedId}`)
        if (!sid) {
            sid = uuidv4()
            localStorage.setItem(`kszap_session_${embedId}`, sid)
        }
        setSessionId(sid)

        // 2. Load Config
        fetch(`${apiUrl}/embed/${embedId}`)
            .then(res => {
                if (!res.ok) throw new Error('Falha ao carregar configuração do agente.')
                return res.json()
            })
            .then(data => setConfig(data))
            .catch(err => setError(err.message))

        // 3. Load History
        fetch(`${apiUrl}/embed/${embedId}/history/${sid}`)
            .then(res => res.json())
            .then(data => {
                if (data.messages && data.messages.length > 0) {
                    setMessages(data.messages)
                }
            })
            .catch(err => console.error('Erro ao carregar histórico:', err))
    }, [embedId, apiUrl])

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isLoading])

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading || !sessionId) return

        const userMsg: Message = { role: 'user', content: inputValue, ts: Date.now() }
        setMessages(prev => [...prev, userMsg])
        setInputValue('')
        setIsLoading(true)

        try {
            const res = await fetch(`${apiUrl}/embed/${embedId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    message: userMsg.content
                })
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.message || 'Erro ao enviar mensagem.')
            }

            const data = await res.json()
            const assistantMsg: Message = { role: 'assistant', content: data.response, ts: Date.now() }
            setMessages(prev => [...prev, assistantMsg])
        } catch (err: any) {
            console.error('Erro no chat:', err)
            setMessages(prev => [...prev, { role: 'assistant', content: `Desculpe, ocorreu um erro: ${err.message}` }])
        } finally {
            setIsLoading(false)
        }
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4 text-center">
                <div className="text-red-500 font-medium">{error}</div>
            </div>
        )
    }

    if (!config) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-transparent">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden font-sans">
            {/* Header */}
            <header
                className="px-4 py-3 text-white flex items-center gap-3 shadow-sm"
                style={{ backgroundColor: config.brandColor }}
            >
                {config.brandLogo ? (
                    <img src={config.brandLogo} alt="Logo" className="w-8 h-8 rounded-full object-cover bg-white p-0.5" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                        {config.agentName[0].toUpperCase()}
                    </div>
                )}
                <div>
                    <h1 className="font-semibold text-sm leading-tight">{config.agentName}</h1>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        <span className="text-[10px] opacity-80 uppercase tracking-wider font-medium">Online</span>
                    </div>
                </div>
            </header>

            {/* Chat Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50"
                style={{ scrollBehavior: 'smooth' }}
            >
                {/* Welcome Message */}
                {config.welcomeMsg && messages.length === 0 && (
                    <div className="flex justify-start">
                        <div className="bg-white text-gray-800 p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-sm max-w-[85%] whitespace-pre-wrap">
                            {config.welcomeMsg}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                        <div
                            className={`p-3 rounded-2xl text-sm max-w-[85%] shadow-sm whitespace-pre-wrap ${msg.role === 'user'
                                    ? 'text-white rounded-tr-none'
                                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                                }`}
                            style={{
                                backgroundColor: msg.role === 'user' ? config.brandColor : undefined
                            }}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <footer className="p-3 bg-white border-t border-gray-100">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-center gap-2 bg-gray-100 p-1 rounded-full group focus-within:ring-2 focus-within:ring-opacity-20 transition-all"
                    style={{ '--tw-ring-color': config.brandColor } as any}
                >
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={config.placeholder}
                        disabled={isLoading}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 py-1.5 text-gray-700 placeholder:text-gray-400 disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !inputValue.trim()}
                        className="p-1.5 rounded-full text-white transition-all disabled:opacity-50 disabled:grayscale hover:opacity-90 active:scale-95 flex items-center justify-center shrink-0"
                        style={{ backgroundColor: config.brandColor }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </form>
                <div className="mt-2 text-center">
                    <a href="https://kszap.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
                        Powered by <span className="font-bold">KSZap</span>
                    </a>
                </div>
            </footer>
        </div>
    )
}
