import { IsInt, IsNumber, Min, Max, IsOptional, IsEnum } from 'class-validator';
import { MediaSource, MediaType } from '@prisma/client';

export class CreateRatingDto {
  @IsInt()
  mediaId!: number;

  // L-23: fonte da obra. Opcional para versões antigas da app; sem ela é deduzida
  // de mediaType e do catálogo.
  @IsOptional()
  @IsEnum(MediaSource, {
    message: 'fonte deve ser ANILIST, TMDB_TV ou TMDB_MOVIE.',
  })
  fonte?: MediaSource;

  @IsOptional()
  @IsEnum(MediaType, { message: 'mediaType deve ser ANIME ou MANGA.' })
  mediaType?: MediaType;

  @IsNumber()
  @Min(0)
  @Max(10)
  score!: number;
}
