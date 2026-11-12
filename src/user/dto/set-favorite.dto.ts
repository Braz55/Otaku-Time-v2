import { IsInt, IsEnum, IsOptional, IsString } from 'class-validator';
import { MediaSource, MediaType } from '@prisma/client';

export class SetFavoriteDto {
  @IsOptional()
  @IsInt()
  mediaId?: number;

  // Nome antigo de mediaId (versões antigas da app)
  @IsOptional()
  @IsInt()
  anilistMediaId?: number;

  // L-23: fonte da obra; sem ela é deduzida de mediaType/format e do catálogo
  @IsOptional()
  @IsEnum(MediaSource)
  fonte?: MediaSource;

  @IsOptional()
  @IsString()
  format?: string;

  // Prateleira do destaque: top 3 de anime ou de manga
  @IsEnum(MediaType)
  mediaType!: MediaType;

  @IsInt()
  rankPosition!: number;
}
