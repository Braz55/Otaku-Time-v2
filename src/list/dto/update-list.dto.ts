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

  // Ignorado: as listas são sempre privadas. Mantido para versões antigas da app que ainda o enviam.
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsOptional()
  @IsObject()
  criteria?: CreateListDto['criteria'];
}
