import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
    @ApiProperty({ example: 'Atendente Jr.', description: 'Nome do perfil de acesso' })
    @IsString()
    @IsNotEmpty({ message: 'Nome do perfil é obrigatório' })
    @MaxLength(80)
    name: string;

    @ApiPropertyOptional({ example: 'Atendimento básico de tickets' })
    @IsString()
    @IsOptional()
    @MaxLength(255)
    description?: string;

    @ApiPropertyOptional({
        type: [String],
        example: ['tickets:read', 'tickets:create', 'contacts:read'],
        description: 'Lista de permissões concedidas ao perfil',
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    permissions?: string[];
}
