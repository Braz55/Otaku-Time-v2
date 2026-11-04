import { IsInt, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export const COMMENT_MAX_LENGTH = 1000;

export class CreateCommentDto {
  @IsInt()
  mediaId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_MAX_LENGTH, {
    message: `O comentário não pode ter mais de ${COMMENT_MAX_LENGTH} caracteres.`,
  })
  text!: string;
}
