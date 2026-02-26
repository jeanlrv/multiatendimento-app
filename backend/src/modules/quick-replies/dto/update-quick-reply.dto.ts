import { PartialType } from '@nestjs/mapped-types';
import { CreateQuickReplyDto } from './create-quick-reply.dto';

export class UpdateQuickReplyDto extends PartialType(CreateQuickReplyDto) { }
