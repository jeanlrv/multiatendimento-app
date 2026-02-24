'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Falha ao realizar login. Verifique suas credenciais.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 aurora overflow-hidden bg-[#F8F6F6] dark:bg-[#050505]">
            {/* Nav Header Estilo ZIP */}
            <header className="flex items-center justify-between px-10 py-6 absolute top-0 left-0 w-full z-20">
                <div className="flex items-center gap-3 text-slate-900 dark:text-white">
                    <div className="p-2 bg-primary rounded-lg text-white shadow-lg shadow-primary/20">
                        <span className="text-xl font-black italic">KS</span>
                    </div>
                    <h2 className="text-xl font-extrabold leading-tight tracking-tighter">KSZap</h2>
                </div>
                <div className="hidden md:flex gap-6">
                    <Link className="text-sm font-bold text-slate-500 hover:text-primary transition-colors uppercase tracking-widest" href="#">Suporte</Link>
                    <Link className="text-sm font-bold text-slate-500 hover:text-primary transition-colors uppercase tracking-widest" href="#">Privacidade</Link>
                </div>
            </header>

            <div className="relative z-10 w-full max-w-[480px]">
                <div className="glass-heavy rounded-3xl p-8 md:p-12 border border-white/80 dark:border-white/10">
                    <div className="mb-10 text-center">
                        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">Bem-vindo</h1>
                        <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">Insira suas credenciais para acessar sua conta</p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium animate-pulse">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-700 dark:text-gray-300 ml-1 uppercase tracking-widest">Endereço de Email</label>
                            <div className="relative group">
                                <input
                                    type="email"
                                    required
                                    className="block w-full px-4 py-4 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                                    placeholder="nome@empresa.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-widest">Senha</label>
                                <Link className="text-[10px] font-black text-primary hover:underline uppercase tracking-tight" href="#">Esqueceu a senha?</Link>
                            </div>
                            <div className="relative group">
                                <input
                                    type="password"
                                    required
                                    className="block w-full px-4 py-4 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 px-1">
                            <input className="w-4 h-4 text-primary border-slate-300 dark:border-white/10 rounded focus:ring-primary bg-transparent" id="remember" type="checkbox" />
                            <label className="text-xs font-bold text-slate-600 dark:text-gray-400 cursor-pointer" htmlFor="remember">Permanecer conectado por 30 dias</label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 uppercase tracking-widest text-xs disabled:opacity-50"
                        >
                            {loading ? 'AUTENTICANDO...' : 'ENTRAR NO SISTEMA'}
                        </button>
                    </form>

                    <div className="mt-10 text-center">
                        <Link href="/" className="text-[10px] font-black text-slate-400 hover:text-primary transition-colors uppercase tracking-[0.2em]">
                            ← Voltar para a Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
