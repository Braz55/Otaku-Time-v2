import { IsString, IsOptional, IsInt, IsBoolean, IsEnum } from 'class-validator';
import { TrackingStatus } from '@prisma/client';

export class UpdateAnimeDto {
  @IsEnum(TrackingStatus)
  @IsOptional()
  status?: TrackingStatus;

  @IsInt()
  @IsOptional()
  seasonAtual?: number;

  @IsInt()
  @IsOptional()
  epAtual?: number;

  // Episódio global (soma de todas as temporadas); tem prioridade sobre seasonAtual/epAtual
  @IsInt()
  @IsOptional()
  epAtualGlobal?: number;

  @IsInt()
  @IsOptional()
  prioridade?: number;

  @IsString()
  @IsOptional()
  linksPersonalizados?: string;

  @IsString()
  @IsOptional()
  notas?: string;

  @IsBoolean()
  @IsOptional()
  wasDropped?: boolean;

  @IsOptional()
  watchedSpecials?: any;

  @IsInt()
  @IsOptional()
  numEpisodiosTotal?: number;

  @IsString()
  @IsOptional()
  tipo?: string;

  @IsString()
  @IsOptional()
  capaUrl?: string;

  @IsString()
  @IsOptional()
  bannerUrl?: string;
}
