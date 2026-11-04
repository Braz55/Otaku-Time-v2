import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsObject,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, {
    message: 'A palavra-passe deve ter pelo menos 8 caracteres.',
  })
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
