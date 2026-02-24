import { IsString, IsNotEmpty, IsObject, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SimulateWorkflowDto {
    @ApiProperty({ required: false })
    @IsString()
    ruleId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    event: string;

    @ApiProperty({ required: false })
    nodes?: any[];

    @ApiProperty({ required: false })
    edges?: any[];

    @ApiProperty()
    @IsObject()
    payload: any;
}
