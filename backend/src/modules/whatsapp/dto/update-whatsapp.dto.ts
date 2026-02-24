import { PartialType } from '@nestjs/swagger';
import { CreateWhatsAppDto } from './create-whatsapp.dto';

export class UpdateWhatsAppDto extends PartialType(CreateWhatsAppDto) { }
