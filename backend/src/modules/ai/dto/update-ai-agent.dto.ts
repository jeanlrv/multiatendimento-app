import { PartialType } from '@nestjs/swagger';
import { CreateAIAgentDto } from './create-ai-agent.dto';

export class UpdateAIAgentDto extends PartialType(CreateAIAgentDto) { }
