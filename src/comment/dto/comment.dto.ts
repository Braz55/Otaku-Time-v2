import {
  IsInt,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { MediaType } from '@prisma/client';

export const COMMENT_MAX_LENGTH = 1000;

export class CreateCommentDto {
  @IsInt()
  mediaId!: number;

  // L-24: opcional para versões antigas da app; sem ele, o tipo é deduzido do catálogo.
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
