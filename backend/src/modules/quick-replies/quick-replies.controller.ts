import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { QuickRepliesService } from './quick-replies.service';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';
import { UpdateQuickReplyDto } from './dto/update-quick-reply.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Quick Replies')
@Controller('quick-replies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuickRepliesController {
  constructor(private readonly quickRepliesService: QuickRepliesService) { }

  @Post()
  @ApiOperation({ summary: 'Criar uma nova resposta rápida' })
  create(@Req() req: any, @Body() createQuickReplyDto: CreateQuickReplyDto) {
    return this.quickRepliesService.create(req.user.companyId, createQuickReplyDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as respostas rápidas da empresa' })
  findAll(@Req() req: any) {
    return this.quickRepliesService.findAll(req.user.companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter uma resposta rápida específica' })
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.quickRepliesService.findOne(req.user.companyId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar uma resposta rápida' })
  update(@Req() req: any, @Param('id') id: string, @Body() updateQuickReplyDto: UpdateQuickReplyDto) {
    return this.quickRepliesService.update(req.user.companyId, id, updateQuickReplyDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover uma resposta rápida' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.quickRepliesService.remove(req.user.companyId, id);
  }
}
