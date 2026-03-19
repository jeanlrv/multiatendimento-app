export interface ZApiWebhookPayload {
    type?: string;
    instanceId: string;
    clientToken?: string;
    messageId: string;
    phone: string;
    fromMe?: boolean;
    isGroup?: boolean;
    isNewsletter?: boolean;
    isStatus?: boolean;
    reactionMessage?: any;
    senderName?: string;
    senderPhoto?: string;
    chatName?: string;
    status?: string;
    ids?: string[]; // Para eventos de status

    // Campos de formato de mensagem diferentes
    text?: { message: string };
    image?: { imageUrl?: string; url?: string; caption?: string; [key: string]: any };
    audio?: { audioUrl?: string; url?: string; [key: string]: any };
    video?: { videoUrl?: string; url?: string; caption?: string; [key: string]: any };
    document?: { documentUrl?: string; url?: string; fileName?: string; [key: string]: any };
    sticker?: { stickerUrl?: string; [key: string]: any };
    location?: { latitude: number; longitude: number; [key: string]: any };
    contact?: any;
    buttonResponse?: { selectedButtonLabel?: string };
    listResponse?: { selectedTitle?: string };

    // Fallbacks da Z-API legada ou outros Providers
    body?: string;
    message?: string;
    caption?: string;
}

export interface ExtractedMessage {
    messageType: any; // Type from Prisma Client
    content: string;
    mediaUrl?: string;
}
