import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { FileType } from '@prisma/client';

export class IngestionDto {
  @IsInt()
  contentTypeId: number;

  @IsInt()
  contentYear: number;

  @IsEnum(FileType)
  type: FileType;

  @IsOptional()
  @IsString()
  metadata?: string;
}
