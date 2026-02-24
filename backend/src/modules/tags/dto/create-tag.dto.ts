import { IsString, IsNotEmpty, IsOptional, IsHexColor } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTagDto {
    @ApiProperty({ description: 'Nome da tag', example: 'Urgente' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Cor da tag em HEX', example: '#EF4444', required: false })
    @IsOptional()
    @IsHexColor()
    color?: string;
}
