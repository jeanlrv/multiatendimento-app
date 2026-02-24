import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContactDto {
    @ApiProperty({ description: 'Nome do contato' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Número de telefone' })
    @IsString()
    @IsNotEmpty()
    phoneNumber: string;

    @ApiProperty({ description: 'Email do contato', required: false })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiProperty({ description: 'Foto de perfil', required: false })
    @IsString()
    @IsOptional()
    profilePicture?: string;

    @ApiProperty({ description: 'Informação adicional fixa', required: false })
    @IsString()
    @IsOptional()
    information?: string;

    @ApiProperty({ description: 'Notas editáveis sobre o contato', required: false })
    @IsString()
    @IsOptional()
    notes?: string;
}
