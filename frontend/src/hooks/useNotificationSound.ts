'use client';

export const NOTIFICATION_SOUNDS = [
    { id: 'soft',    label: 'Suave',         url: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3' },
    { id: 'chime',   label: 'Chime',          url: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' },
    { id: 'pop',     label: 'Pop',            url: 'https://assets.mixkit.co/active_storage/sfx/2356/2356-preview.mp3' },
    { id: 'bell',    label: 'Sino',           url: 'https://assets.mixkit.co/active_storage/sfx/2357/2357-preview.mp3' },
    { id: 'bubble',  label: 'Bolha',          url: 'https://assets.mixkit.co/active_storage/sfx/2355/2355-preview.mp3' },
    { id: 'ding',    label: 'Ding',           url: 'https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3' },
    { id: 'alert',   label: 'Alerta',         url: 'https://assets.mixkit.co/active_storage/sfx/2360/2360-preview.mp3' },
    { id: 'ping',    label: 'Ping Digital',   url: 'https://assets.mixkit.co/active_storage/sfx/2361/2361-preview.mp3' },
    { id: 'tap',     label: 'Toque Suave',    url: 'https://assets.mixkit.co/active_storage/sfx/2362/2362-preview.mp3' },
    { id: 'notify',  label: 'Notificação',    url: 'https://assets.mixkit.co/active_storage/sfx/2363/2363-preview.mp3' },
] as const;

export type SoundId = typeof NOTIFICATION_SOUNDS[number]['id'];

const LS_SOUND_KEY    = 'kszap_notification_sound';
const LS_ENABLED_KEY  = 'kszap_sound_enabled';

function getSoundUrl(id?: string | null): string {
    const found = NOTIFICATION_SOUNDS.find(s => s.id === (id ?? 'soft'));
    return found?.url ?? NOTIFICATION_SOUNDS[0].url;
}

export function playPreview(url: string) {
    new Audio(url).play().catch(() => {});
}

export function useNotificationSound() {
    const play = (type: 'message' | 'mention' = 'message') => {
        if (typeof window === 'undefined') return;
        if (localStorage.getItem(LS_ENABLED_KEY) === 'false') return;

        const id = localStorage.getItem(LS_SOUND_KEY);
        // Mention usa o mesmo som configurado (pode ser customizado futuramente)
        const url = getSoundUrl(id);
        new Audio(url).play().catch(() => {});
    };

    const getSavedSoundId = (): SoundId => {
        if (typeof window === 'undefined') return 'soft';
        return (localStorage.getItem(LS_SOUND_KEY) as SoundId) ?? 'soft';
    };

    const setSoundId = (id: SoundId) => {
        localStorage.setItem(LS_SOUND_KEY, id);
    };

    const isSoundEnabled = (): boolean => {
        if (typeof window === 'undefined') return true;
        return localStorage.getItem(LS_ENABLED_KEY) !== 'false';
    };

    const setSoundEnabled = (enabled: boolean) => {
        localStorage.setItem(LS_ENABLED_KEY, enabled ? 'true' : 'false');
    };

    return { play, getSavedSoundId, setSoundId, isSoundEnabled, setSoundEnabled };
}
