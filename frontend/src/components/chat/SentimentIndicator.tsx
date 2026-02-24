'use client';

import { motion } from 'framer-motion';
import { Smile, Meh, Frown, Sparkles } from 'lucide-react';

interface SentimentIndicatorProps {
    sentiment?: string;
    score?: number;
    className?: string;
}

export function SentimentIndicator({ sentiment, score, className = '' }: SentimentIndicatorProps) {
    const getSentimentConfig = () => {
        const s = sentiment?.toUpperCase() || 'NEUTRAL';
        if (s.includes('POSITIVE') || s === 'POSITIVO' || (score && score >= 4)) {
            return {
                icon: <Smile className="text-emerald-500" size={16} />,
                color: 'bg-emerald-500/10 border-emerald-500/20',
                label: 'Positivo',
                textColor: 'text-emerald-500',
                shadow: 'shadow-emerald-500/20'
            };
        }
        if (s.includes('NEGATIVE') || s === 'NEGATIVO' || (score && score <= 2)) {
            return {
                icon: <Frown className="text-rose-500" size={16} />,
                color: 'bg-rose-500/10 border-rose-500/20',
                label: 'Crítico',
                textColor: 'text-rose-500',
                shadow: 'shadow-rose-500/20'
            };
        }
        return {
            icon: <Meh className="text-amber-500" size={16} />,
            color: 'bg-amber-500/10 border-amber-500/20',
            label: 'Neutro',
            textColor: 'text-amber-500',
            shadow: 'shadow-amber-500/20'
        };
    };

    const config = getSentimentConfig();

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${config.color} ${config.shadow} shadow-lg ${className}`}
        >
            {config.icon}
            <span className={`text-[10px] font-black uppercase tracking-widest ${config.textColor}`}>
                {config.label}
            </span>
            {score && (
                <div className="flex items-center gap-0.5 ml-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <div
                            key={star}
                            className={`h-1 w-1 rounded-full ${star <= score ? config.textColor.replace('text', 'bg') : 'bg-slate-300 dark:bg-white/10'}`}
                        />
                    ))}
                </div>
            )}
        </motion.div>
    );
}
