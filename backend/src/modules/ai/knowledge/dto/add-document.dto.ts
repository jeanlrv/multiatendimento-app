import { IsString, IsOptional, IsEnum, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DocumentSourceType {
    TEXT = 'TEXT',
    TXT = 'TXT',
    MD = 'MD',
    HTML = 'HTML',
    CSV = 'CSV',
    JSON = 'JSON',
    YAML = 'YAML',
    XML = 'XML',
    RTF = 'RTF',
    PDF = 'PDF',
    DOCX = 'DOCX',
    XLSX = 'XLSX',
    XLS = 'XLS',
    PPTX = 'PPTX',
    EPUB = 'EPUB',
    CODE = 'CODE',
    AUDIO = 'AUDIO',
    URL = 'URL',
    YOUTUBE = 'YOUTUBE',
    GITHUB = 'GITHUB',
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
