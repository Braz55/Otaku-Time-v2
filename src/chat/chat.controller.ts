import { Controller, Post, Body, Get, Param, Delete, UseGuards, Req, Res } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Response } from 'express';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('sessions')
  async createSession(@Req() req, @Body('titulo') titulo: string) {
    return this.chatService.createSession(req.user.userId, titulo);
  }

  @Get('sessions')
  async getSessions(@Req() req) {
    return this.chatService.getSessions(req.user.userId);
  }

  @Get('sessions/:id/messages')
  async getMessages(@Param('id') id: string) {
    return this.chatService.getSessionMessages(Number(id));
  }

  @Post('sessions/:id/messages')
  async sendMessage(
    @Param('id') id: string, 
    @Body('message') message: string,
    @Res() res: Response
  ) {
    const sessionId = Number(id);
    
    // 1. Guarda a mensagem do utilizador
    await this.chatService.saveMessage(sessionId, 'user', message);

    // 2. Dispara a auto-nomeação em background (sem bloquear o chat)
    this.chatService.autoRenameSession(sessionId, message).catch(console.error);
    
    // 3. Configura os headers para Streaming (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 4. Inicia o Stream da IA
    const stream = await this.chatService.generateStreamResponse(sessionId, message);
    if (!stream) {
      res.write('data: {"error": "Falha no stream"}\n\n');
      return res.end();
    }

    const reader = stream.getReader();
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        // O Ollama envia vários objetos JSON no stream. Vamos passá-los para o frontend.
        res.write(`data: ${chunk}\n\n`);

        // Vamos guardando o texto para salvar na DB no fim
        try {
          const parsed = JSON.parse(chunk);
          if (parsed.response) fullContent += parsed.response;
        } catch (e) {
          // Às vezes o chunk pode vir cortado, ignoramos erros de parse aqui
        }
      }
    } finally {
      // 5. Quando o stream acaba, guarda a resposta completa na DB
      if (fullContent) {
        await this.chatService.saveMessage(sessionId, 'assistant', fullContent);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string) {
    return this.chatService.deleteSession(Number(id));
  }
}
