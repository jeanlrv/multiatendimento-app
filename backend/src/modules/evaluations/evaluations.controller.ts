import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Evaluations')
@Controller('evaluations')
export class EvaluationsController {
    constructor(private readonly evaluationsService: EvaluationsService) { }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Listar todas as avaliações' })
    findAll(@Req() req: any) {
        return this.evaluationsService.findAll(req.user.companyId);
    }

    // Endpoint PÚBLICO — sem JwtAuthGuard — para a página de avaliação do cliente
    @Get('public/:ticketId')
    @ApiOperation({ summary: 'Buscar dados públicos do ticket para exibir na página de avaliação' })
    getPublicTicketInfo(@Param('ticketId') ticketId: string) {
        return this.evaluationsService.getPublicTicketInfo(ticketId);
    }

    @Post('customer')
    @ApiOperation({ summary: 'Receber avaliação do cliente (público)' })
    submitCustomerEvaluation(@Req() req: any, @Body() body: { ticketId: string; rating: number; feedback?: string }) {
        return this.evaluationsService.submitPublicEvaluation(body.ticketId, body.rating, body.feedback);
    }

    @Get('ticket/:ticketId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Obter avaliação de um ticket específico' })
    findByTicket(@Req() req: any, @Param('ticketId') ticketId: string) {
        return this.evaluationsService.findByTicket(req.user.companyId, ticketId);
    }
}

