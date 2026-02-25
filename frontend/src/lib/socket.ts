import { io, Socket } from 'socket.io-client';

const BASE_URL = process.env.NEXT_PUBLIC_WS_URL || '';

const sockets: Record<string, Socket> = {};

export const getSocket = (token: string, namespace: 'chat' | 'collab' = 'chat'): Socket => {
    // Se BASE_URL for vazia, o socket.io tenta o host atual
    // O prefixo /socket.io/ já é o padrão do socket.io-client
    const url = BASE_URL ? `${BASE_URL}/${namespace}` : `/${namespace}`;

    if (!sockets[namespace]) {
        sockets[namespace] = io(url, {
            path: '/socket.io',
            auth: { token: `Bearer ${token}` },
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
