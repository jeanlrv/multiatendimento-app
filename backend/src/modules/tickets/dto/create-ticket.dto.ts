import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTicketDto {
    @ApiProperty({ description: 'ID do contato do cliente' })
    @IsUUID()
    @IsNotEmpty()
    contactId: string;

    @ApiProperty({ description: 'ID do departamento' })
    @IsUUID()
    @IsNotEmpty()
    departmentId: string;

    @ApiProperty({ description: 'ID da conexão WhatsApp' })
    @IsUUID()
    @IsNotEmpty()
    connectionId: string;

    @ApiProperty({ description: 'Assunto do chamado', required: false })
    @IsString()
    @IsOptional()
    subject?: string;

    @ApiProperty({ description: 'Tags do chamado', required: false, type: [String] })
    @IsOptional()
    tags?: string[];
}
