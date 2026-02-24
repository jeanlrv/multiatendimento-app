import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean; // Cmd no Mac
    description: string;
    action: () => void;
    preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
    enabled?: boolean;
    preventDefault?: boolean;
}

/**
 * Hook para gerenciar atalhos de teclado
 * Suporta combinações de teclas e previne conflitos
 */
export function useKeyboardShortcuts(
    shortcuts: KeyboardShortcut[],
    options: UseKeyboardShortcutsOptions = {}
) {
    const { enabled = true, preventDefault = true } = options;

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (!enabled) return;

            // Ignorar se estiver digitando em inputs, textareas ou elementos editáveis
            const target = event.target as HTMLElement;
            const isEditable =
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable;

            for (const shortcut of shortcuts) {
                if (!shortcut.key) continue;

                const keyMatches =
                    event.key.toLowerCase() === shortcut.key.toLowerCase();
                const ctrlMatches = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
                const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey;
                const altMatches = shortcut.alt ? event.altKey : !event.altKey;
                const metaMatches = shortcut.meta ? event.metaKey : !event.metaKey;

                if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
                    // Permitir Esc mesmo em campos editáveis
                    if (shortcut.key.toLowerCase() === 'escape' || !isEditable) {
                        if (preventDefault || shortcut.preventDefault !== false) {
                            event.preventDefault();
                        }
                        shortcut.action();
                        break;
                    }
                }
            }
        },
        [shortcuts, enabled, preventDefault]
    );

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown, enabled]);
}

/**
 * Formata um atalho para exibição visual
 * Ex: { key: 'k', ctrl: true } => "Ctrl+K" ou "⌘K" no Mac
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const parts: string[] = [];

    if (shortcut.ctrl || shortcut.meta) {
        parts.push(isMac ? '⌘' : 'Ctrl');
    }
    if (shortcut.shift) {
        parts.push(isMac ? '⇧' : 'Shift');
    }
    if (shortcut.alt) {
        parts.push(isMac ? '⌥' : 'Alt');
    }

    // Formatar tecla especial
    const keyMap: Record<string, string> = {
        escape: 'Esc',
        enter: '↵',
        arrowup: '↑',
        arrowdown: '↓',
        arrowleft: '←',
        arrowright: '→',
    };

    const validKey = shortcut.key || '';
    const displayKey = keyMap[validKey.toLowerCase()] || validKey.toUpperCase();
    parts.push(displayKey);

    return parts.join(isMac ? '' : '+');
}
