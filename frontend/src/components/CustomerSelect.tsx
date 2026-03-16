'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/services/api';
import { Building2, X, ChevronDown } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

export interface CustomerOption {
    id: string;
    name: string;
    type: 'PERSON' | 'COMPANY';
    status: string;
}

interface CustomerSelectProps {
    value?: CustomerOption | null;
    onChange: (customer: CustomerOption | null) => void;
    placeholder?: string;
    className?: string;
}

export function CustomerSelect({
    value,
    onChange,
    placeholder = 'Filtrar por cliente...',
    className = '',
}: CustomerSelectProps) {
    const [searchInput, setSearchInput] = useState('');
    const [results, setResults] = useState<CustomerOption[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const search = useDebounce(searchInput, 400);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (search.length >= 2) {
            setLoading(true);
            api.get('/customers', { params: { search, limit: 10 } })
                .then(r => setResults(r.data?.data || []))
                .catch(() => setResults([]))
                .finally(() => setLoading(false));
        } else {
            setResults([]);
        }
    }, [search]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (value) {
        return (
            <div className={`flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${className}`}>
                <Building2 size={12} className="flex-shrink-0" />
                <span className="truncate max-w-[120px]">{value.name}</span>
                <button
                    onClick={() => onChange(null)}
                    className="hover:bg-primary/20 rounded p-0.5 flex-shrink-0 transition-colors"
                    title="Remover filtro"
                >
                    <X size={10} />
                </button>
            </div>
        );
    }

    return (
        <div ref={ref} className={`relative ${className}`}>
            <div
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 cursor-text"
                onClick={() => { setOpen(true); }}
            >
                <Building2 size={12} className="text-slate-400 flex-shrink-0" />
                <input
                    type="text"
                    value={searchInput}
                    onChange={e => { setSearchInput(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none w-28 text-slate-600 dark:text-slate-300 placeholder:text-slate-400"
                />
                <ChevronDown size={10} className="text-slate-400 flex-shrink-0" />
            </div>

            {open && (
                <div className="absolute top-full mt-1 left-0 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {loading && (
                        <div className="px-3 py-2.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Buscando...
                        </div>
                    )}
                    {!loading && search.length < 2 && (
                        <div className="px-3 py-2.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Digite para buscar clientes
                        </div>
                    )}
                    {!loading && search.length >= 2 && results.length === 0 && (
                        <div className="px-3 py-2.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Nenhum cliente encontrado
                        </div>
                    )}
                    {results.map(c => (
                        <button
                            key={c.id}
                            onClick={() => {
                                onChange(c);
                                setSearchInput('');
                                setOpen(false);
                                setResults([]);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 dark:hover:bg-primary/10 text-left transition-colors border-b border-slate-100 dark:border-white/5 last:border-0"
                        >
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs flex-shrink-0">
                                {c.name?.charAt(0) || '#'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                                    {c.type === 'PERSON' ? 'Pessoa' : 'Empresa'}
                                    {c.status === 'ACTIVE' ? ' · Ativo' : c.status === 'LEAD' ? ' · Lead' : ' · Inativo'}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
