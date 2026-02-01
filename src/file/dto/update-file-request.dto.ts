// src/file/dto/update-file-request.dto.ts
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FileTranslationDto {
  @IsString()
  languageCode: string;

  @IsString()
  displayName: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateFileRequestDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileTranslationDto)
  translations?: FileTranslationDto[];

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsInt()
  subcategoryId?: number;
}
