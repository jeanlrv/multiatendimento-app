import { IsOptional, IsString } from 'class-validator';

export class UpdateBrandingDto {
    @IsOptional()
    @IsString()
    logoUrl?: string;

    @IsOptional()
    @IsString()
    primaryColor?: string;

    @IsOptional()
    @IsString()
    secondaryColor?: string;
}
