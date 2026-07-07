import { IsInt, IsOptional, IsNumber } from 'class-validator';

export class UpdateUserStatisticsDto {
  @IsInt()
  @IsOptional()
  totalAnimeCompleted?: number;

  @IsInt()
  @IsOptional()
  totalEpisodesWatched?: number;

  @IsInt()
  @IsOptional()
  totalMangaRead?: number;

  @IsNumber()
  @IsOptional()
  animeDaysWasted?: number;

  @IsNumber()
  @IsOptional()
  mangaDaysWasted?: number;
}
