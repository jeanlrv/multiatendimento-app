import { PartialType } from '@nestjs/swagger';
import { CreateContactDto } from './create-contact.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateContactDto extends PartialType(CreateContactDto) {
    @ApiProperty({ description: 'ID do cliente vinculado (null para desvincular)', required: false, nullable: true })
    @IsString()
    @IsOptional()
    customerId?: string | null;
}
