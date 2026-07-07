import { IsInt, IsString, IsNotEmpty } from 'class-validator';

export class CreateCommentDto {
  @IsInt()
  mediaId!: number;

  @IsString()
  @IsNotEmpty()
  text!: string;
}
