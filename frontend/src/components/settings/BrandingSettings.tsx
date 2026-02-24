'use client';

import { useState, useEffect, useRef } from 'react';
import { Palette, Upload, Globe, RefreshCcw, Save, Image as ImageIcon, Camera, X } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { hexToHsl } from '@/lib/colors';

export function BrandingSettings() {
    const { company, updateCompany } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [branding, setBranding] = useState({
        logoUrl: '',
        primaryColor: '#3B82F6',
        secondaryColor: '#1E293B',
    });

    useEffect(() => {
        const fetchBranding = async () => {
            try {
                const response = await api.get('/companies/me');
                if (response.data) {
                    setBranding({
                        logoUrl: response.data.logoUrl || '',
                        primaryColor: response.data.primaryColor || '#3B82F6',
                        secondaryColor: response.data.secondaryColor || '#1E293B',
                    });
                }
            } catch (error) {
                console.error('Erro ao buscar branding:', error);
                toast.error('Erro ao carregar dados de branding');
            } finally {
                setLoading(false);
            }
        };
        fetchBranding();
    }, []);

    // Upload de logo via arquivo
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingLogo(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const uploadResp = await api.post('/uploads', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const { url } = uploadResp.data;

            setBranding(prev => ({ ...prev, logoUrl: url }));
            toast.success('Logo carregada! Clique em "Salvar" para confirmar.');
        } catch {
            toast.error('Erro ao fazer upload da logo');
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleSaveBranding = async () => {
        setSaving(true);
        try {
            await api.patch('/companies/branding', branding);

            // Atualizar AuthContext para refletir no header em tempo real
            if (updateCompany) {
                updateCompany({
                    logoUrl: branding.logoUrl,
                    primaryColor: branding.primaryColor,
                    secondaryColor: branding.secondaryColor
                });
            }

            // Atualizar variável CSS de cor primária em tempo real (Tailwind HSL)
            try {
                const hsl = hexToHsl(branding.primaryColor);
                document.documentElement.style.setProperty('--primary', hsl);
                document.documentElement.style.setProperty('--ring', hsl);
            } catch (e) {
                console.error('Erro ao converter cor:', e);
            }

            toast.success('Identidade visual salva com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar branding:', error);
            toast.error('Erro ao salvar identidade visual.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-center p-10 font-black animate-pulse text-primary tracking-widest uppercase text-xs">Carregando Identidade Visual...</div>;

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-6 mb-12">
                <div className="p-5 bg-primary/10 text-primary rounded-[1.5rem] border border-primary/20 shadow-inner">
                    <Palette size={32} />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter italic">Identidade Visual</h3>
                    <p className="text-[10px] font-black text-slate-400 shadow-inner uppercase tracking-[0.2em] mt-1 italic">Personalização premium da interface Aero</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Logo Section */}
                <div className="space-y-6">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 flex items-center gap-2">
                        <ImageIcon size={14} /> Logotipo da Empresa
                    </label>

                    {/* Logo Preview Area + Upload */}
                    <div className="p-10 bg-slate-50 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 group hover:border-primary/50 transition-all">
                        {branding.logoUrl ? (
                            <div className="relative">
                                <img src={branding.logoUrl} alt="Logo" className="h-20 object-contain drop-shadow-2xl" />
                                <button
                                    onClick={() => setBranding(prev => ({ ...prev, logoUrl: '' }))}
                                    className="absolute -top-2 -right-2 h-6 w-6 bg-rose-500 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                                    title="Remover logo"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <div className="h-20 w-20 flex items-center justify-center bg-white dark:bg-white/5 rounded-3xl shadow-xl border border-slate-100 dark:border-white/10 text-slate-300">
                                <Upload size={32} />
                            </div>
                        )}

                        {/* Upload File Button */}
                        <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoUpload}
                        />
                        <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={uploadingLogo}
                            className="flex items-center gap-2 px-6 py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-primary/20 disabled:opacity-50"
                        >
                            {uploadingLogo ? <RefreshCcw size={14} className="animate-spin" /> : <Camera size={14} />}
                            {uploadingLogo ? 'Carregando...' : 'Carregar Logo'}
                        </button>

                        {/* URL Manual */}
                        <div className="w-full space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">ou cole a URL diretamente</p>
                            <input
                                type="text"
                                value={branding.logoUrl}
                                onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                                className="w-full bg-white dark:bg-gray-900 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-xs focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white text-center font-mono"
                                placeholder="https://... (PNG, SVG, WEBP)"
                            />
                        </div>
                    </div>
                </div>

                {/* Cores Section */}
                <div className="space-y-8">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 flex items-center gap-2">
                            <Globe size={14} /> Cor Primária (Ações e Destaques)
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="color"
                                value={branding.primaryColor}
                                onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                                className="h-16 w-16 rounded-2xl cursor-pointer bg-white dark:bg-white/5 p-1 border border-slate-200 dark:border-white/10 shadow-xl"
                            />
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={branding.primaryColor}
                                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white font-black italic"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 flex items-center gap-2">
                            <Palette size={14} /> Cor Secundária (Superfícies e Bordas)
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="color"
                                value={branding.secondaryColor}
                                onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                                className="h-16 w-16 rounded-2xl cursor-pointer bg-white dark:bg-white/5 p-1 border border-slate-200 dark:border-white/10 shadow-xl"
                            />
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={branding.secondaryColor}
                                    onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-6 py-4 text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all dark:text-white font-black italic"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Preview Card */}
                    <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/10">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Preview em Tempo Real</p>
                        <div className="flex items-center gap-3">
                            <button className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg" style={{ backgroundColor: branding.primaryColor }}>
                                Botão Primário
                            </button>
                            <div className="h-10 w-10 rounded-xl" style={{ backgroundColor: branding.secondaryColor }} />
                            {branding.logoUrl && (
                                <img src={branding.logoUrl} alt="logo preview" className="h-8 object-contain" />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-12 border-t border-slate-100 dark:border-white/5">
                <button
                    onClick={handleSaveBranding}
                    disabled={saving}
                    className="flex items-center gap-4 bg-primary hover:bg-primary/90 text-white px-10 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] transition-all shadow-[0_15px_40px_rgba(56,189,248,0.3)] disabled:opacity-50 active:scale-95 group"
                >
                    {saving ? <RefreshCcw className="animate-spin h-5 w-5" /> : <Save size={20} className="group-hover:rotate-12 transition-transform" />}
                    SALVAR IDENTIDADE VISUAL
                </button>
            </div>
        </div>
    );
}
