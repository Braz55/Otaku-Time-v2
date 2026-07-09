import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class ImportAnimeDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsInt()
  @IsOptional()
  anilistId?: number;

  @IsString()
  @IsOptional()
  format?: string;
}
