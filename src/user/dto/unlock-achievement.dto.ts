import { IsInt } from 'class-validator';

export class UnlockAchievementDto {
  @IsInt()
  achievementId!: number;
}
