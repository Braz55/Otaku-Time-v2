import {
  IsArray,
  IsOptional,
  IsInt,
  IsString,
  IsNotEmpty,
  ValidateNested,
  IsEnum,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TrackingStatus } from '@prisma/client';

class BackupAnimeDto {
  // L-23: TMDB_TV ou TMDB_MOVIE; ausente em backups antigos
  @IsOptional()
  @IsIn(['TMDB_TV', 'TMDB_MOVIE'])
  fonte?: 'TMDB_TV' | 'TMDB_MOVIE';

  @IsInt()
  animeId!: number;

  @IsOptional()
  @IsString()
  formato?: string;

  @IsString()
  @IsNotEmpty()
  titulo!: string;

  @IsEnum(TrackingStatus)
  status!: TrackingStatus;

  @IsInt()
  @IsOptional()
  epAtual?: number;

  @IsInt()
  @IsOptional()
  prioridade?: number;

  @IsInt()
  @IsOptional()
  numEpisodiosTotal?: number;
}

class BackupMangaDto {
  @IsInt()
  mangaId!: number;

  @IsString()
  @IsNotEmpty()
  titulo!: string;

  @IsEnum(TrackingStatus)
  status!: TrackingStatus;

  @IsInt()
  @IsOptional()
  capAtual?: number;

  @IsInt()
  @IsOptional()
  prioridade?: number;

  @IsInt()
  @IsOptional()
  numCapitulosTotal?: number;
}

class BackupDataDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BackupAnimeDto)
  animes?: BackupAnimeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BackupMangaDto)
  mangas?: BackupMangaDto[];
}

export class RestoreBackupDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => BackupDataDto)
  data!: BackupDataDto;
}
