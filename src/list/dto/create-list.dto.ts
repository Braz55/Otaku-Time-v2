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

  // Ignorado: as listas são sempre privadas. Mantido para versões antigas da app que ainda o enviam.
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
