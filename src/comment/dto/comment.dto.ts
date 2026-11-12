import {
  IsInt,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { MediaSource, MediaType } from '@prisma/client';

export const COMMENT_MAX_LENGTH = 1000;

export class CreateCommentDto {
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_MAX_LENGTH, {
    message: `O comentário não pode ter mais de ${COMMENT_MAX_LENGTH} caracteres.`,
  })
  text!: string;
}
