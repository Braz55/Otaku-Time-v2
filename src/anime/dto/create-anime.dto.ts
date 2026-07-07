import { IsString, IsOptional, IsInt, IsDate, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAnimeDto {
  @IsString()
  titulo!: string;

  @IsString()
  statusLancamento!: string;

  @IsOptional()
  @IsObject()
  generos!: any;

  @IsInt()
  userId!: number;

  // Campos opcionais (com ?) não precisam do !
  @IsString()
  @IsOptional()
  capaUrl?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  dataLancamento?: Date;

  @IsInt()
  @IsOptional()
  numTemporadas?: number;

  @IsInt()
  @IsOptional()
  numEpisodiosTotal?: number;

  @IsString()
  @IsOptional()
  statusVisualizacao?: string;

  @IsInt()
  @IsOptional()
  epAtual?: number;

  @IsString()
  @IsOptional()
  temporada?: string;

  @IsInt()
  @IsOptional()
  ano?: number;
}
