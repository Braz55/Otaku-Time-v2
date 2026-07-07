import { IsString, IsNotEmpty } from 'class-validator';

export class RedeemGiftCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
