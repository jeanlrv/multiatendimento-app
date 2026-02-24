'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Mail, Settings, Zap, SlidersHorizontal, Palette, Building2
} from 'lucide-react';

// Atomic Components
import { SmtpSettings } from '@/components/settings/SmtpSettings';
import { IntegrationsManager } from '@/components/settings/IntegrationsManager';
import { GeneralParams } from '@/components/settings/GeneralParams';
import { SystemSettings } from '@/components/settings/SystemSettings';
import { BrandingSettings } from '@/components/settings/BrandingSettings';
import { CompanyManager } from '@/components/settings/CompanyManager';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'companies' | 'smtp' | 'integrations' | 'system' | 'params' | 'branding'>('companies');

    const tabs = [
        { id: 'companies', label: 'Unidades Operacionais', icon: <Building2 size={16} /> },
        { id: 'branding', label: 'Identidade Visual', icon: <Palette size={16} /> },
        { id: 'smtp', label: 'E-mail (SMTP)', icon: <Mail size={16} /> },
        { id: 'integrations', label: 'Integrações', icon: <Zap size={16} /> },
        { id: 'params', label: 'Parâmetros', icon: <SlidersHorizontal size={16} /> },
        { id: 'system', label: 'Sistema', icon: <Settings size={16} /> },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-12 relative liquid-glass aurora pb-20">
            <div className="relative z-10 px-4">
                <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter italic flex items-center gap-4">
                    <Settings className="text-primary h-10 w-10 shadow-[0_0_20px_rgba(56,189,248,0.3)]" />
                    Central <span className="text-primary italic">Aero</span>
                </h1>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 ml-14 italic">Configurações de Missão e Identidade Corporativa</p>
            </div>

            {/* Tabs Aero */}
            <div className="flex gap-2 p-2 liquid-glass dark:bg-white/5 rounded-[2rem] border border-slate-200 dark:border-white/10 relative z-10 mx-4 shadow-xl overflow-x-auto no-scrollbar">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-3 px-6 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden group whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-primary text-white shadow-2xl shadow-primary/30'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                            }`}
                    >
                        {tab.icon} {tab.label}
                        {activeTab === tab.id && (
                            <motion.div layoutId="settingTab" className="absolute inset-0 bg-primary -z-10" />
                        )}
                    </button>
                ))}
            </div>

            <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="liquid-glass dark:bg-slate-900/90 p-8 md:p-12 rounded-[3.5rem] shadow-2xl relative z-10 mx-4 border border-slate-200 dark:border-white/10 min-h-[500px]"
            >
                {activeTab === 'companies' && <CompanyManager />}
                {activeTab === 'branding' && <BrandingSettings />}
                {activeTab === 'smtp' && <SmtpSettings />}
                {activeTab === 'integrations' && <IntegrationsManager />}
                {activeTab === 'params' && <GeneralParams />}
                {activeTab === 'system' && <SystemSettings />}
            </motion.div>
        </div>
    );
}
