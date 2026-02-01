import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { FileType } from '@prisma/client';
import { Type } from 'class-transformer';

export class IngestionDto {
  @Type(() => Number)
  @IsInt()
  contentTypeId: number;

  @Type(() => Number)
  @IsInt()
  contentYear: number;

  @IsEnum(FileType)
  type: FileType;

  @IsString()
  lang: string;

  @IsOptional()
  @IsString()
  metadata?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subcategoryId?: number;
}
