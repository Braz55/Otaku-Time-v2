import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { CreateListDto } from './create-list.dto';

export class UpdateListDto implements Partial<CreateListDto> {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  coverUrl?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsOptional()
  @IsObject()
  criteria?: CreateListDto['criteria'];
}
