import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateKnowledgeBaseDto {
    @ApiProperty({ example: 'Base de Conhecimento Geral' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'Contém informações sobre a empresa e produtos.', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: 'openai', required: false })
    @IsString()
    @IsOptional()
    embeddingProvider?: string;

    @ApiProperty({ example: 'text-embedding-3-small', required: false })
    @IsString()
    @IsOptional()
    embeddingModel?: string;
}
