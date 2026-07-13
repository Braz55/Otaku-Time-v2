import { IsString, IsOptional, IsInt, IsBoolean, IsEnum, IsNumber } from 'class-validator';
import { TrackingStatus } from '@prisma/client';

export class UpdateMangaDto {
  @IsEnum(TrackingStatus)
  @IsOptional()
  status?: TrackingStatus;

  @IsNumber()
  @IsOptional()
  capAtual?: number;

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

  @IsInt()
  @IsOptional()
  numCapitulosTotal?: number;
}
