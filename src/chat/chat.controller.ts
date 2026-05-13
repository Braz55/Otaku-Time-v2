import { Controller, Post, Body, Get, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Criar nova sessão
  @Post('sessions')
  async createSession(@Req() req, @Body('titulo') titulo: string) {
    return this.chatService.createSession(req.user.userId, titulo);
  }

  // Listar sessões do utilizador
  @Get('sessions')
  async getSessions(@Req() req) {
    return this.chatService.getSessions(req.user.userId);
  }

  // Obter mensagens de uma sessão
  @Get('sessions/:id/messages')
  async getMessages(@Param('id') id: string) {
    return this.chatService.getSessionMessages(Number(id));
  }

  // Enviar mensagem e receber resposta da IA
  @Post('sessions/:id/messages')
  async sendMessage(@Param('id') id: string, @Body('message') message: string) {
    const sessionId = Number(id);
    
    // 1. Guarda a mensagem do utilizador
    await this.chatService.saveMessage(sessionId, 'user', message);
    
    // 2. Gera a resposta da IA
    const aiResponse = await this.chatService.generateResponse(sessionId, message);
    
    // 3. Guarda a resposta da IA
    const savedAiMsg = await this.chatService.saveMessage(sessionId, 'assistant', aiResponse);
    
    return savedAiMsg;
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string) {
    return this.chatService.deleteSession(Number(id));
  }
}
