import { MessageType } from '@prisma/client';

export interface EmitNewMessageParams {
    id: string;
    ticketId: string;
    content: string;
    fromMe: boolean;
    origin: 'CLIENT' | 'AGENT' | 'AI';
    messageType: MessageType;
    mediaUrl?: string | null;
    status: string;
    sentAt: Date;
    readAt?: Date | null;
    externalId?: string | null;
    quotedMessageId?: string | null;
    transcription?: string | null;
}

export interface EmitMentionParams {
    ticketId: string;
    messageId: string;
    mentionContent: string;
}

export interface EmotionEvaluation {
    score: number;
    emotion: string;
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    analysis?: string;
}
