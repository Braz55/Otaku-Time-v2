import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class UpdateSubscriptionDto {
  @IsString()
  @IsOptional()
  planType?: string;

  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;

  @IsDateString()
  @IsOptional()
  currentPeriodEnd?: string;
}
