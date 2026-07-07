import { IsInt, IsNumber, Min, Max } from 'class-validator';

export class CreateRatingDto {
  @IsInt()
  mediaId!: number;

  @IsNumber()
  @Min(0)
  @Max(10)
  score!: number;
}
