import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWhatsAppDto {
    @ApiProperty({ description: 'Nome da conexão (ex: Comercial, Suporte)' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ description: 'Número de telefone exibido na conexão (ex: 5511999999999)' })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'ID da instância Z-API (obtido no portal Z-API)' })
    @IsString()
    @IsOptional()
    zapiInstanceId?: string;

    @ApiPropertyOptional({ description: 'Token da instância Z-API (obtido no portal Z-API)' })
    @IsString()
    @IsOptional()
    zapiToken?: string;

    @ApiPropertyOptional({ description: 'Client-Token (Security Token) da Z-API — opcional, necessário se ativado no portal' })
    @IsString()
    @IsOptional()
    zapiClientToken?: string;

    @ApiPropertyOptional({ description: 'IDs dos departamentos vinculados (múltiplos)', type: [String] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    departmentIds?: string[];

    @ApiPropertyOptional({ description: 'Se a conexão está ativa', default: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
