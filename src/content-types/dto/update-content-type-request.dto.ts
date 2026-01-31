import { IsArray, IsInt, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ContentTypeTranslationDto } from './content-type-translation.dto';

export class UpdateContentTypeDto {
  @IsOptional()
  @IsInt()
  contentYear?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentTypeTranslationDto)
  translations?: ContentTypeTranslationDto[];
}
