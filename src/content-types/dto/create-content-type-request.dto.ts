import { IsInt, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ContentTypeTranslationDto } from './content-type-translation.dto';

export class CreateContentTypeDto {
  @IsInt()
  categoryId: number;

  @IsOptional()
  @IsInt()
  subcategoryId?: number;

  @IsOptional()
  @IsInt()
  contentYear?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentTypeTranslationDto)
  translations: ContentTypeTranslationDto[];
}
