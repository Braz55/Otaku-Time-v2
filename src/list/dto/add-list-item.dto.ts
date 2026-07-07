import { IsInt, IsEnum } from 'class-validator';
import { MediaType } from '@prisma/client';

export class AddListItemDto {
  @IsInt()
  anilistMediaId!: number;

  @IsEnum(MediaType)
  mediaType!: MediaType;
}
