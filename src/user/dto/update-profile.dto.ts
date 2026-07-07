import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

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
  password?: string;

  @IsString()
  @IsOptional()
  currentPassword?: string;
}
