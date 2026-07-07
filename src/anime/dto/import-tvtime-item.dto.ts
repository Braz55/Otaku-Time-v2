import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TvdbIdDto {
  @IsOptional()
  tvdb?: string | number;
}

export class TVTimeEpisodeDto {
  @IsOptional()
  @IsBoolean()
  special?: boolean;

  @IsOptional()
  @IsBoolean()
  is_watched?: boolean;

  @IsOptional()
  number?: string | number;
}

export class TVTimeSeasonDto {
  @IsOptional()
  @IsBoolean()
  is_specials?: boolean;

  @IsOptional()
  number?: string | number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TVTimeEpisodeDto)
  episodes?: TVTimeEpisodeDto[];
}

export class ImportTVTimeItemDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TvdbIdDto)
  id?: TvdbIdDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TVTimeSeasonDto)
  seasons?: TVTimeSeasonDto[];
}
