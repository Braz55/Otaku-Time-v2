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

  @IsInt()
  @IsOptional()
  prioridade?: number;

  @IsString()
  @IsOptional()
  linksPersonalizados?: string;

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
}
