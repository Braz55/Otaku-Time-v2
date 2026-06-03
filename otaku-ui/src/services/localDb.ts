import Dexie, { type Table } from 'dexie';

export interface LocalUser {
  id?: number;
  email: string;
  nome: string;
  password?: string;
}

export interface LocalAnimeItem {
  id?: number;
  userId: number;
  animeId: number; // ID da AniList
  titulo: string;
  statusLancamento: string;
  capaUrl: string;
  generos: string;
  descricao: string;
  status: 'WATCHING' | 'PLANNED' | 'COMPLETED' | 'DROPPED';
  epAtual: number;
  numEpisodiosTotal?: number | null;
  temporada?: string | null;
  ano?: number | null;
  prioridade?: number | null;
  linksExternos?: string | null;
  linksPersonalizados?: string | null;
  proximoEpisodio?: number | null;
  proximoEpisodioData?: string | null;
  updatedAt?: string;
}

export interface LocalMangaItem {
  id?: number;
  userId: number;
  mangaId: number; // ID da AniList
  titulo: string;
  statusLancamento: string;
  capaUrl: string;
  generos: string;
  descricao: string;
  status: 'WATCHING' | 'PLANNED' | 'COMPLETED' | 'DROPPED';
  capAtual: number;
  numCapitulosTotal?: number | null;
  prioridade?: number | null;
  linksExternos?: string | null;
  linksPersonalizados?: string | null;
  proximoCapituloNumero?: number | null;
  proximoCapituloData?: string | null;
  updatedAt?: string;
}

export interface LocalChatSession {
  id?: number;
  userId: number;
  titulo: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalChatMessage {
  id?: number;
  sessionId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export class OtakuLocalDB extends Dexie {
  users!: Table<LocalUser, number>;
  animes!: Table<LocalAnimeItem, number>;
  mangas!: Table<LocalMangaItem, number>;
  chatSessions!: Table<LocalChatSession, number>;
  chatMessages!: Table<LocalChatMessage, number>;

  constructor() {
    super('OtakuTimeLocalDB');
    this.version(1).stores({
      users: '++id, email',
      animes: '++id, userId, animeId, status',
      mangas: '++id, userId, mangaId, status',
      chatSessions: '++id, userId',
      chatMessages: '++id, sessionId'
    });
  }
}

export const localDb = new OtakuLocalDB();
