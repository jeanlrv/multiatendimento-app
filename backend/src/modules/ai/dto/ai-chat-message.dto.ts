export interface AiChatMessage {
    role: 'user' | 'assistant' | 'system' | 'client';
    content: string;
}
