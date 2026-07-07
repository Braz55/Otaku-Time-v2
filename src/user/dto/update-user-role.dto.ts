import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateUserRoleDto {
  @IsString()
  @IsNotEmpty()
  tipoConta!: string;
}
