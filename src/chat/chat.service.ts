import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly ollamaUrl = 'http://localhost:11434/api/generate';
  private readonly model = 'llama3.1';

  async createSession(userId: number, titulo: string) {
    return this.prisma.chatSession.create({
      data: { userId, titulo: titulo || 'Nova Conversa' },
    });
  }

  async getSessions(userId: number) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getSessionMessages(sessionId: number) {
    return this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async saveMessage(sessionId: number, role: 'user' | 'assistant', content: string) {
    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
    return this.prisma.chatMessage.create({
      data: { sessionId, role, content },
    });
  }

  private async searchAnilist(query: string) {
    const yearMatch = query.match(/\b(20\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1]) : undefined;
    const cleanQuery = query.replace(/\b(20\d{2})\b/g, '').trim();

    const gqlQuery = `
      query ($search: String, $year: Int) {
        Page(perPage: 15) {
          media(search: $search, seasonYear: $year, sort: POPULARITY_DESC, type: ANIME) {
            id
            title { english romaji }
            genres
            description
          }
        }
      }
    `;

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gqlQuery, variables: { search: cleanQuery || undefined, year } })
      });
      const data = await response.json() as any;
      return data.data?.Page?.media || [];
    } catch { return []; }
  }

  private async detectSearchIntent(prompt: string): Promise<string | null> {
    const detectPrompt = `Identify keywords for anime search from this: "${prompt}". Return ONLY keywords or "NONE".`;
    try {
      const response = await fetch(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: detectPrompt, stream: false }),
      });
      const data = await response.json() as any;
      const res = data.response?.trim();
      return (res.includes('NONE')) ? null : res;
    } catch { return null; }
  }

  // Gera o título automático da sessão
  async autoRenameSession(sessionId: number, firstMessage: string) {
    const session = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
    if (!session || (session.titulo !== 'Nova Conversa' && session.titulo !== 'Nova Conversa')) return;

    const prompt = `Create a short, creative 3-word title in Portuguese for a chat starting with: "${firstMessage}". Return ONLY the title.`;
    try {
      const res = await fetch(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt, stream: false }),
      });
      const data = await res.json() as any;
      const newTitle = data.response?.replace(/["']/g, '').trim() || 'Conversa';
      await this.prisma.chatSession.update({ where: { id: sessionId }, data: { titulo: newTitle } });
    } catch (e) { console.error('Erro ao renomear:', e); }
  }

  async generateStreamResponse(sessionId: number, prompt: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        user: { include: { animes: { include: { anime: true } }, mangas: { include: { manga: true } } } }
      }
    });

    if (!session) throw new Error('Sessão não encontrada');

    // Detectar intenção e contexto (simplificado para velocidade)
    const searchTerms = await this.detectSearchIntent(prompt);
    let searchContext = '';
    if (searchTerms) {
      const results = await this.searchAnilist(searchTerms);
      searchContext = results.length > 0 ? `Catalogo: ${results.map((r: any) => r.title.english || r.title.romaji).join(', ')}` : '';
    }

    const systemPrompt = `
      És o Otaku Bot, um sommelier apaixonado por animes e mangas.
      Contexto utilizador: ${session.user.animes.map(a => a.anime.titulo).join(', ')}.
      ${searchContext}
      Sê entusiasta, justifica as tuas recomendações e usa [REC:ID] para obras que conheças o ID da AniList.
    `;

    const response = await fetch(this.ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: `${systemPrompt}\n\nUser: ${prompt}\nBot:`,
        stream: true,
      }),
    });

    return response.body; // Devolve o stream direto do fetch
  }

  async deleteSession(sessionId: number) {
    return this.prisma.chatSession.delete({ where: { id: sessionId } });
  }
}
