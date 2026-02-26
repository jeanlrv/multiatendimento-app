import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQuickReplyDto {
    @ApiProperty({ example: '/ola' })
    @IsString()
    @IsNotEmpty()
    shortcut: string;

    @ApiProperty({ example: 'Olá, como posso ajudar?' })
    @IsString()
    @IsNotEmpty()
    content: string;
}
