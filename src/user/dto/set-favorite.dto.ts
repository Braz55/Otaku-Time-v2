import { IsInt, IsEnum } from 'class-validator';
import { MediaType } from '@prisma/client';

export class SetFavoriteDto {
  @IsInt()
  anilistMediaId!: number;

  @IsEnum(MediaType)
  mediaType!: MediaType;

  @IsInt()
  rankPosition!: number;
}
