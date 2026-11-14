import { IsIn, IsInt, IsPositive } from 'class-validator';

// Passar uma obra do catálogo para outro ID do TMDB (ação de administração)
export class MigrateAnimeIdDto {
  // Obra de origem, tal como está no catálogo
  @IsIn(['TMDB_TV', 'TMDB_MOVIE'])
  fonte!: 'TMDB_TV' | 'TMDB_MOVIE';

  @IsInt()
  @IsPositive()
  id!: number;

  // Obra de destino no TMDB
  @IsInt()
  @IsPositive()
  tmdbId!: number;

  @IsIn(['TV', 'MOVIE'])
  format!: 'TV' | 'MOVIE';
}
