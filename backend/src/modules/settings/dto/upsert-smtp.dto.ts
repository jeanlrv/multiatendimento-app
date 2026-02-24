import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertSmtpDto {
    @IsString()
    @IsNotEmpty()
    host: string;

    @IsInt()
    @Min(1)
    @Max(65535)
    @Type(() => Number)
    port: number;

    @IsString()
    @IsNotEmpty()
    user: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsEmail()
    fromEmail: string;

    @IsString()
    @IsNotEmpty()
    fromName: string;

    @IsOptional()
    secure?: boolean;
}
