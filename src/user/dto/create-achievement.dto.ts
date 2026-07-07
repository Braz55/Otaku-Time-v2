import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateAchievementDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsOptional()
  badgeImageUrl?: string;

  @IsString()
  @IsOptional()
  rarity?: string;
}
