import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateListDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  coverUrl?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsOptional()
  @IsObject()
  criteria?: {
    genres?: string[];
    tags?: string[];
    mediaTypes?: ('ANIME' | 'MANGA')[];
  } | null;
}
