import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContentTypeTranslationDto } from './content-type-translation.dto';
import { ContentStatus } from '@prisma/client';

export class UpdateContentTypeDto {
  @IsOptional()
  @IsInt()
  contentYear?: number;

  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentTypeTranslationDto)
  translations?: ContentTypeTranslationDto[];
}
