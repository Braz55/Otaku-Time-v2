import { IsInt, IsNumber, Min, Max, IsOptional, IsEnum } from 'class-validator';
import { MediaType } from '@prisma/client';

export class CreateRatingDto {
  @IsInt()
  mediaId!: number;

  // L-24: opcional para versões antigas da app; sem ele, o tipo é deduzido do catálogo.
  @IsOptional()
  @IsEnum(MediaType, { message: 'mediaType deve ser ANIME ou MANGA.' })
  mediaType?: MediaType;

  @IsNumber()
  @Min(0)
  @Max(10)
  score!: number;
}
