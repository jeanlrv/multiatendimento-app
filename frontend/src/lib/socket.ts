import { io, Socket } from 'socket.io-client';

const BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

const sockets: Record<string, Socket> = {};

export const getSocket = (token: string, namespace: 'chat' | 'collab' = 'chat'): Socket => {
    const url = `${BASE_URL}/${namespace}`;

    if (!sockets[namespace]) {
        sockets[namespace] = io(url, {
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
