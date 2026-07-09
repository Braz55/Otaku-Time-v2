import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class ImportMangaDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsInt()
  @IsOptional()
  anilistId?: number;
}
