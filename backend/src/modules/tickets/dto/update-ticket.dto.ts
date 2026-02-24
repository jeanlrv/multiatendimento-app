import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TicketStatus, TicketPriority } from '@prisma/client';

export { TicketStatus, TicketPriority };

export class UpdateTicketDto {
    @ApiProperty({ enum: TicketStatus, required: false })
    @IsEnum(TicketStatus)
    @IsOptional()
    status?: TicketStatus;

    @ApiProperty({ enum: TicketPriority, required: false })
    @IsEnum(TicketPriority)
    @IsOptional()
    priority?: TicketPriority;

    @ApiProperty({ description: 'ID do usuário atribuído', required: false })
    @IsUUID()
    @IsOptional()
    assignedUserId?: string;

    @ApiProperty({ description: 'Assunto do chamado', required: false })
    @IsString()
    @IsOptional()
    subject?: string;

    @ApiProperty({ description: 'ID do departamento', required: false })
    @IsUUID()
    @IsOptional()
    departmentId?: string;

    @ApiProperty({ enum: ['AI', 'HUMANO', 'HIBRIDO'], required: false })
    @IsEnum(['AI', 'HUMANO', 'HIBRIDO'])
    @IsOptional()
    mode?: 'AI' | 'HUMANO' | 'HIBRIDO';
}
