import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { FileType } from '@prisma/client';
import { Type } from 'class-transformer';

export class IngestionDto {
  @Type(() => Number)
  @IsInt()
  contentTypeId: number;

  @IsInt()
  contentYear: number;

  @IsEnum(FileType)
  type: FileType;

  @IsOptional()
  @IsString()
  metadata?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
