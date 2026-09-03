// src/file/dto/update-file-request.dto.ts
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { ApiProperty } from '@nestjs/swagger';

export class FileTranslationDto {
  @IsString()
  languageCode!: string;

  @IsString()
  displayName!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateFileRequestDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  languageCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  parentId?: number;
}
