import { IsString, IsOptional, MaxLength, IsEnum, IsUUID } from 'class-validator';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
    @IsString()
    @MaxLength(10000, { message: 'Mensagem não pode ultrapassar 10.000 caracteres' })
    content: string;

    @IsOptional()
    @IsEnum(MessageType)
    type?: MessageType;

    @IsOptional()
    @IsString()
    @MaxLength(2048)
    mediaUrl?: string;

    @IsOptional()
    @IsUUID()
    quotedMessageId?: string;
}

export class CreateMacroDto {
    @IsString()
    @MaxLength(100, { message: 'Título da macro não pode ultrapassar 100 caracteres' })
    title: string;

    @IsString()
    @MaxLength(5000, { message: 'Conteúdo da macro não pode ultrapassar 5.000 caracteres' })
    content: string;
}
