import { IsString, IsOptional, IsInt, IsObject } from 'class-validator';

export class CreateMangaDto {
  @IsString()
  titulo!: string;

  @IsString()
  statusLancamento!: string;

  @IsInt()
  @IsOptional()
  numCapitulosTotal?: number;

  @IsString()
  @IsOptional()
  capaUrl?: string;

  @IsOptional()
  @IsObject()
  generos!: any; // Como definiste no Prisma

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsString()
  @IsOptional()
  statusLeitura?: string;

  @IsInt()
  @IsOptional()
  capAtual?: number;

  @IsInt()
  @IsOptional()
  prioridade?: number;

  @IsInt()
  userId!: number; // Obrigatório para ligar ao User
}
