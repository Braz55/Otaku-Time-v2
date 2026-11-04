import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { TrackingStatus } from '@prisma/client';

export class UpdateMangaDto {
  @IsEnum(TrackingStatus)
  @IsOptional()
  status?: TrackingStatus;

  @IsNumber()
  @IsOptional()
  capAtual?: number;

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

  @IsInt()
  @IsOptional()
  numCapitulosTotal?: number;

  @IsString()
  @IsOptional()
  capaUrl?: string;

  @IsString()
  @IsOptional()
  bannerUrl?: string;
}
