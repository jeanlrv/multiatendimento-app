import { IsString, IsOptional, IsEmail, IsEnum, IsNotEmpty, Matches } from 'class-validator';

export enum CustomerTypeDto {
    PERSON = 'PERSON',
    COMPANY = 'COMPANY',
}

export enum CustomerStatusDto {
    LEAD = 'LEAD',
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
}

export class CreateCustomerDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsEnum(CustomerTypeDto)
    type?: CustomerTypeDto;

    @IsOptional()
    @Matches(/^\d{11}$|^\d{14}$/, { message: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos (somente números)' })
    cpfCnpj?: string;

    @IsOptional()
    @IsEmail()
    emailPrimary?: string;

    @IsOptional()
    @IsString()
    phonePrimary?: string;

    @IsOptional()
    @IsEnum(CustomerStatusDto)
    status?: CustomerStatusDto;

    @IsOptional()
    @IsString()
    origin?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}
