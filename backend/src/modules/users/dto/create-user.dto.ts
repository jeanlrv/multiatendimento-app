import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({ example: 'admin@whatsapp-saas.com' })
    @IsEmail({}, { message: 'Email inválido' })
    @IsNotEmpty({ message: 'Email é obrigatório' })
    email: string;

    @ApiProperty({ example: 'Admin@123' })
    @IsString()
    @IsNotEmpty({ message: 'Senha é obrigatória' })
    @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres' })
    password: string;

    @ApiProperty({ example: 'Administrador' })
    @IsString()
    @IsNotEmpty({ message: 'Nome é obrigatório' })
    name: string;

    @ApiProperty({ example: 'uuid-do-role' })
    @IsUUID()
    @IsNotEmpty({ message: 'Role ID é obrigatório' })
    roleId: string;

    @ApiProperty({ example: 'uuid-do-department', required: false })
    @IsUUID()
    @IsOptional()
    departmentId?: string;

    @ApiProperty({ example: true, required: false })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @ApiProperty({ example: ['uuid-1', 'uuid-2'], required: false })
    @IsUUID('all', { each: true })
    @IsOptional()
    departmentIds?: string[];
}
