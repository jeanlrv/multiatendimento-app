const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function getVapidPublicKey(): Promise<string | null> {
    try {
        const res = await fetch(`${API_URL}/api/notifications/vapid-public-key`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.publicKey ?? null;
    } catch {
        return null;
    }
}

export async function subscribeToPush(token: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    try {
        const vapidPublicKey = await getVapidPublicKey();
        if (!vapidPublicKey) return false;

        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return true; // já inscrito

        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        const sub = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        await fetch(`${API_URL}/api/notifications/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(sub),
        });

        return true;
    } catch {
        return false;
    }
}

export async function unsubscribeFromPush(token: string): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;

        await fetch(`${API_URL}/api/notifications/subscribe`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ endpoint: sub.endpoint }),
        });

        await sub.unsubscribe();
    } catch {
        // silencioso
    }
}
