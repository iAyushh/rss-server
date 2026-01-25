import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryTranslationDto } from './category-translation.dto';

export class CreateCategoryRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryTranslationDto)
  translations: CategoryTranslationDto[];
}
