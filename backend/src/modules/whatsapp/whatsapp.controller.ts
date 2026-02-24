import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { CreateWhatsAppDto } from './dto/create-whatsapp.dto';
import { UpdateWhatsAppDto } from './dto/update-whatsapp.dto';
import { SubscriptionLimit } from '../../common/decorators/subscription-limit.decorator';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';

@ApiTags('WhatsApp')
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WhatsAppController {
    constructor(private readonly whatsAppService: WhatsAppService) { }

    @Get()
    @ApiOperation({ summary: 'Listar todas as conexões WhatsApp' })
    async findAll(@Req() req) {
        return this.whatsAppService.findAll(req.user.companyId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obter uma conexão pelo ID' })
    async findOne(@Param('id') id: string, @Req() req) {
        return this.whatsAppService.findOne(id, req.user.companyId);
    }

    @Get(':id/qrcode')
    @ApiOperation({ summary: 'Gerar QR Code para conexão' })
    async getQrCode(@Param('id') id: string, @Req() req) {
        return this.whatsAppService.getQrCode(id, req.user.companyId);
    }

    @Get(':id/status')
    @ApiOperation({ summary: 'Verificar status da conexão na Z-API' })
    async checkStatus(@Param('id') id: string, @Req() req) {
        return this.whatsAppService.checkStatus(id, req.user.companyId);
    }

    @Post()
    @UseGuards(SubscriptionGuard)
    @SubscriptionLimit('maxWhatsApp')
    @ApiOperation({ summary: 'Criar uma nova conexão' })
    async create(@Body() createWhatsAppDto: CreateWhatsAppDto, @Req() req) {
        return this.whatsAppService.create(createWhatsAppDto, req.user.companyId);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Atualizar uma conexão' })
    async update(
        @Param('id') id: string,
        @Body() updateWhatsAppDto: UpdateWhatsAppDto,
        @Req() req
    ) {
        return this.whatsAppService.update(id, updateWhatsAppDto, req.user.companyId);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Excluir uma conexão' })
    async remove(@Param('id') id: string, @Req() req) {
        return this.whatsAppService.remove(id, req.user.companyId);
    }

    // Webhook endpoint will be implemented in a separate WebhookController
    // to handle incoming messages from Z-API
}
