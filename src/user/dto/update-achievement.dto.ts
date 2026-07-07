import { IsString, IsOptional } from 'class-validator';

export class UpdateAchievementDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  badgeImageUrl?: string;

  @IsString()
  @IsOptional()
  rarity?: string;
}
