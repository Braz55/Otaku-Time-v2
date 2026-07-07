import { IsString, IsEmail, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateUserDto {
  @IsString()
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsString()
  @IsOptional()
  preferredLanguage?: string;

  @IsString()
  @IsOptional()
  theme?: string;

  @IsBoolean()
  @IsOptional()
  showAdultContent?: boolean;

  @IsString()
  @IsOptional()
  iconUrl?: string;

  @IsString()
  @IsOptional()
  bannerUrl?: string;

  @IsOptional()
  @IsObject()
  preferences?: any;
}
