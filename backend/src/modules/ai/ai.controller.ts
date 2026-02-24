import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { AIService } from './ai.service';
import { CreateAIAgentDto } from './dto/create-ai-agent.dto';
import { UpdateAIAgentDto } from './dto/update-ai-agent.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('AI')
@Controller('ai/agents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIController {
    constructor(private readonly aiService: AIService) { }

    @Post()
    @ApiOperation({ summary: 'Criar um novo agente de IA' })
    create(@Req() req: any, @Body() createAIAgentDto: CreateAIAgentDto) {
        return this.aiService.createAgent(req.user.companyId, createAIAgentDto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todos os agentes de IA' })
    findAll(@Req() req: any) {
        return this.aiService.findAllAgents(req.user.companyId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obter detalhes de um agente de IA' })
    findOne(@Req() req: any, @Param('id') id: string) {
        return this.aiService.findOneAgent(req.user.companyId, id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Atualizar um agente de IA' })
    update(@Req() req: any, @Param('id') id: string, @Body() updateAIAgentDto: UpdateAIAgentDto) {
        return this.aiService.updateAgent(req.user.companyId, id, updateAIAgentDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Remover um agente de IA' })
    remove(@Req() req: any, @Param('id') id: string) {
        return this.aiService.removeAgent(req.user.companyId, id);
    }

    @Post(':id/chat')
    @ApiOperation({ summary: 'Interagir com o agente de IA' })
    chat(@Req() req: any, @Param('id') id: string, @Body() body: { message: string }) {
        return this.aiService.chat(req.user.companyId, id, body.message);
    }
}
