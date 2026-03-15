import { io, Socket } from 'socket.io-client';

const BASE_URL = process.env.NEXT_PUBLIC_WS_URL || '';

const sockets: Record<string, Socket> = {};

export const getSocket = (token: string | null, namespace: 'chat' | 'collab' = 'chat'): Socket => {
    // Se BASE_URL for vazia, o socket.io tenta o host atual
    // O prefixo /socket.io/ já é o padrão do socket.io-client
    const url = BASE_URL ? `${BASE_URL}/${namespace}` : `/${namespace}`;

    if (!sockets[namespace]) {
        sockets[namespace] = io(url, {
            path: '/socket.io',
            // withCredentials envia os httpOnly cookies no handshake WebSocket
            // auth.token é mantido como fallback para compatibilidade
            withCredentials: true,
            auth: token ? { token: `Bearer ${token}` } : {},
            transports: ['websocket'],
            autoConnect: true,
        });
    }
    return sockets[namespace];
};

export const disconnectAllSockets = () => {
    Object.values(sockets).forEach(socket => socket.disconnect());
    Object.keys(sockets).forEach(key => delete sockets[key]);
};
