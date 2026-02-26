import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateKnowledgeBaseDto {
    @ApiProperty({ example: 'Base de Conhecimento Geral' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'Contém informações sobre a empresa e produtos.', required: false })
    @IsString()
    @IsOptional()
    description?: string;
}
