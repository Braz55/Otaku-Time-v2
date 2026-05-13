import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly ollamaUrl = 'http://localhost:11434/api/generate';
  private readonly model = 'llama3.1';

  // 1. Criar uma nova sessão de chat
  async createSession(userId: number, titulo: string) {
    return this.prisma.chatSession.create({
      data: {
        userId,
        titulo: titulo || 'Nova Conversa',
      },
    });
  }

  // 2. Listar sessões de um utilizador
  async getSessions(userId: number) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // 3. Obter mensagens de uma sessão
  async getSessionMessages(sessionId: number) {
    return this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // 4. Guardar uma mensagem
  async saveMessage(sessionId: number, role: 'user' | 'assistant', content: string) {
    // Atualiza o updatedAt da sessão para ela subir no histórico
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return this.prisma.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
      },
    });
  }

  // 5. Gerar resposta usando o Ollama e o histórico
  async generateResponse(sessionId: number, prompt: string): Promise<string> {
    const history = await this.getSessionMessages(sessionId);
    
    const systemPrompt = `
      És o assistente virtual oficial do OtakuTime, uma plataforma de acompanhamento de animes e mangas.
      O teu objetivo é ajudar o utilizador com recomendações, informações sobre obras e curiosidades do mundo otaku.
      
      Regras de Resposta:
      1. Sê amigável, entusiasta e usa uma linguagem informal (mas respeitosa).
      2. Se o utilizador perguntar algo que não seja relacionado com animes, mangas ou cultura japonesa, tenta gentilmente trazer a conversa de volta para o tema.
      3. Usa Markdown para formatar as tuas respostas (negritos para títulos, listas para recomendações).
      4. Mantém as respostas concisas e interessantes.
      5. Nunca inventes datas de lançamento se não tiveres a certeza.
    `;

    // Constrói o contexto com base nas últimas mensagens (limitar para não estourar o contexto)
    const context = history.slice(-6).map(msg => 
      `${msg.role === 'user' ? 'Utilizador' : 'Assistente'}: ${msg.content}`
    ).join('\n');

    try {
      const fullPrompt = `${systemPrompt}\n\nHistórico:\n${context}\n\nUtilizador: ${prompt}\nAssistente:`;

      const response = await fetch(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: fullPrompt,
          stream: false,
        }),
      });

      if (!response.ok) throw new Error(`Erro Ollama: ${response.statusText}`);

      const data = await response.json() as any;
      const botResponse = data.response || 'Desculpa, não consegui processar a tua resposta.';
      
      return botResponse;
    } catch (error) {
      console.error('Erro no ChatService:', error);
      return 'Ocorreu um erro ao comunicar com o motor de IA. Verifica se o Ollama está ativo.';
    }
  }

  async deleteSession(sessionId: number) {
    return this.prisma.chatSession.delete({
      where: { id: sessionId },
    });
  }
}
