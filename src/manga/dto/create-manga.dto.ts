export class CreateMangaDto {
  titulo!: string;
  statusLancamento!: string;
  numCapitulosTotal?: number;
  capaUrl?: string;
  generos!: string; // Como definiste no Prisma
  autor?: string;
  descricao?: string;
  statusLeitura?: string;
  capAtual?: number;
  prioridade?: number;
  userId!: number; // Obrigatório para ligar ao User
}