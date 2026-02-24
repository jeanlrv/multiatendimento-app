import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateSavedFilterDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsObject()
    @IsNotEmpty()
    filters: any;

    @IsString()
    @IsOptional()
    color?: string;
}
