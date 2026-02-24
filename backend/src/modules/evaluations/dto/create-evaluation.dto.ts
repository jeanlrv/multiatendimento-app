import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateEvaluationDto {
    @ApiProperty({ description: 'ID do Ticket' })
    @IsString()
    ticketId: string;

    @ApiProperty({ description: 'Nota do cliente (0-10)', required: false })
    @IsInt()
    @Min(0)
    @Max(10)
    @IsOptional()
    customerRating?: number;

    @ApiProperty({ description: 'Feedback do cliente', required: false })
    @IsString()
    @IsOptional()
    customerFeedback?: string;
}
