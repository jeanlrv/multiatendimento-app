import { IsString, IsOptional, IsEnum, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DocumentSourceType {
    TEXT = 'TEXT',
    PDF = 'PDF',
    URL = 'URL',
    DOCX = 'DOCX',
}

export class AddDocumentDto {
    @ApiProperty({ example: 'Manual de Instruções' })
    @IsString()
    title: string;

    @ApiProperty({ enum: DocumentSourceType, example: 'TEXT' })
    @IsEnum(DocumentSourceType)
    sourceType: DocumentSourceType;

    @ApiProperty({ example: 'O texto completo do documento...', required: false })
    @IsString()
    @IsOptional()
    rawContent?: string;

    @ApiProperty({ example: 'https://exemplo.com/doc.pdf', required: false })
    @IsUrl()
    @IsOptional()
    contentUrl?: string;
}
