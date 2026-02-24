import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWhatsAppDto {
    @ApiProperty({ description: 'Nome da conexão (ex: Comercial, Suporte)' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ description: 'Número de telefone exibido na conexão' })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({
        description: 'ID da instância Z-API. Opcional quando a integração global está configurada em Configurações → Integrações.',
    })
    @IsString()
    @IsOptional()
    zapiInstanceId?: string;

    @ApiPropertyOptional({
        description: 'Token da instância Z-API. Opcional quando a integração global está configurada em Configurações → Integrações.',
    })
    @IsString()
    @IsOptional()
    zapiToken?: string;

    @ApiPropertyOptional({ description: 'Se a conexão está ativa', default: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiPropertyOptional({ description: 'ID do departamento vinculado a esta conexão' })
    @IsString()
    @IsOptional()
    departmentId?: string;
}
