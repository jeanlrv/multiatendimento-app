"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ModeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="p-2 w-9 h-9 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />;
    }

    return (
        <div className="flex bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 p-1 rounded-2xl">
            <button
                onClick={() => setTheme("light")}
                className={`p-2 rounded-xl transition-all ${theme === 'light' ? 'bg-white text-primary shadow-lg border border-slate-200 dark:border-transparent' : 'text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white'}`}
                title="Modo Claro"
            >
                <Sun className="h-4 w-4" />
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white'}`}
                title="Modo Escuro"
            >
                <Moon className="h-4 w-4" />
            </button>
            <button
                onClick={() => setTheme("system")}
                className={`p-2 rounded-xl transition-all ${theme === 'system' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white'}`}
                title="Automático (Sistema)"
            >
                <div className="h-4 w-4 flex items-center justify-center font-black text-[8px] uppercase">Auto</div>
            </button>
        </div>
    )
}
