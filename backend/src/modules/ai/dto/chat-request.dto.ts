import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional, MaxLength, ArrayMaxSize } from 'class-validator';

export class ChatRequestDto {
    @ApiProperty({ description: 'Mensagem do usuário' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(4000) // Limite de segurança para mensagem individual
    message: string;

    @ApiProperty({ description: 'Histórico de mensagens da conversa', required: false })
    @IsArray()
    @IsOptional()
    @ArrayMaxSize(20) // Limite de segurança para o histórico (últimas 20 mensagens)
    history?: any[];
}
