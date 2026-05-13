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

    // Pesquisa mais abrangente: busca por termo E por género se o termo for curto
    const gqlQuery = `
      query ($search: String, $year: Int) {
        Page(perPage: 15) {
          media(search: $search, seasonYear: $year, sort: POPULARITY_DESC, type: ANIME) {
            id
            title { english romaji }
            genres
            description
            averageScore
          }
        }
      }
    `;

    try {
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: gqlQuery,
          variables: { search: cleanQuery || undefined, year }
        })
      });
      const data = await response.json() as any;
      return data.data?.Page?.media || [];
    } catch (err) {
      return [];
    }
  }

  private async detectSearchIntent(prompt: string): Promise<string | null> {
    const detectPrompt = `Identify the main anime/manga themes or titles in this message. Return ONLY keywords. If it's a general chat, return "NONE".\nMessage: "${prompt}"`;
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

  async generateResponse(sessionId: number, prompt: string): Promise<string> {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            animes: { include: { anime: true } },
            mangas: { include: { manga: true } }
          }
        }
      }
    });

    if (!session) return 'Sessão não encontrada.';

    const searchTerms = await this.detectSearchIntent(prompt);
    let searchContext = '';
    
    if (searchTerms) {
      const results = await this.searchAnilist(searchTerms);
      if (results.length > 0) {
        searchContext = `
        CATÁLOGO DE APOIO (Obras populares relacionadas):
        ${results.map((r: any) => `- ${r.title.english || r.title.romaji} (ID: ${r.id}, Géneros: ${r.genres.join(', ')})`).join('\n')}
        `;
      }
    }

    const history = await this.getSessionMessages(sessionId);
    const userContext = `O utilizador já viu/segue: ${session.user.animes.map(a => a.anime.titulo).join(', ')}`;

    const systemPrompt = `
      És o Otaku Bot, um sommelier de animes e mangas. 
      O teu objetivo é ter conversas profundas, interessantes e dar recomendações variadas e surpreendentes.
      
      DADOS DO UTILIZADOR:
      ${userContext}
      
      ${searchContext}
      
      REGRAS:
      1. Usa o "CATÁLOGO DE APOIO" apenas como inspiração. Podes recomendar obras que NÃO estão lá se achares que são melhores.
      2. Tenta variar as recomendações: sugere um clássico, um "hidden gem" (obra pouco conhecida) e algo recente.
      3. Justifica as tuas escolhas com base no que o utilizador já gosta.
      4. Sê apaixonado por animes! Fala de diretores, estúdios ou animação se fizer sentido.
      5. Se souberes o ID da obra, podes colocar no fim [REC:ID], mas o foco agora é a QUALIDADE da recomendação.
    `;

    try {
      const response = await fetch(this.ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `${systemPrompt}\n\nUser: ${prompt}\nBot:`,
          stream: false,
        }),
      });
      const data = await response.json() as any;
      return data.response || 'Erro na resposta.';
    } catch (error) { return 'Erro de comunicação.'; }
  }

  async deleteSession(sessionId: number) {
    return this.prisma.chatSession.delete({ where: { id: sessionId } });
  }
}
