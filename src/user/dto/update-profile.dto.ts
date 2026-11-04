import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  theme?: string;

  @IsString()
  @IsOptional()
  preferredLanguage?: string;

  @IsString()
  @IsOptional()
  iconUrl?: string | null;

  @IsString()
  @IsOptional()
  bannerUrl?: string | null;

  @IsBoolean()
  @IsOptional()
  showAdultContent?: boolean;

  @IsObject()
  @IsOptional()
  preferences?: any;

  @IsString()
  @IsOptional()
  @MinLength(8, {
    message: 'A palavra-passe deve ter pelo menos 8 caracteres.',
  })
  password?: string;

  @IsString()
  @IsOptional()
  currentPassword?: string;
}
