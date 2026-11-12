import { IsInt, IsEnum, IsOptional, IsString } from 'class-validator';
import { MediaSource, MediaType } from '@prisma/client';

export class AddListItemDto {
  @IsInt()
  mediaId!: number;

  // L-23: fonte da obra. Versões antigas da app mandam só mediaType (e às vezes format)
  @IsOptional()
  @IsEnum(MediaSource)
  fonte?: MediaSource;

  @IsOptional()
  @IsEnum(MediaType)
  mediaType?: MediaType;

  @IsOptional()
  @IsString()
  format?: string;
}
