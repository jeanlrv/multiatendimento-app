import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum BulkTicketAction {
    RESOLVE = 'RESOLVE',
    PAUSE = 'PAUSE',
    ASSIGN = 'ASSIGN',
    DELETE = 'DELETE',
}

export class BulkTicketActionDto {
    @ApiProperty({ description: 'IDs dos tickets para ação em lote', type: [String] })
    @IsArray()
    @IsUUID('all', { each: true })
    ids: string[];

    @ApiProperty({ enum: BulkTicketAction, description: 'Ação a ser executada' })
    @IsEnum(BulkTicketAction)
    action: BulkTicketAction;

    @ApiProperty({ description: 'ID alvo (ex: userId para atribuição)', required: false })
    @IsUUID()
    @IsOptional()
    targetId?: string;
}
