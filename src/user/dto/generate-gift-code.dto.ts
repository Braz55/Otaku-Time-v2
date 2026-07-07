import { IsInt, IsString, IsOptional } from 'class-validator';

export class GenerateGiftCodeDto {
  @IsInt()
  durationDays!: number;

  @IsString()
  @IsOptional()
  customCode?: string;

  @IsString()
  @IsOptional()
  expiresAt?: string;
}
