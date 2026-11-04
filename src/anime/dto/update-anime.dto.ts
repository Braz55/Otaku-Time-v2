import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
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
  @Min(1)
  @Max(10)
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
