import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { SubcategoryTranslationDto } from './subcategory-translation.dto';

export class UpdateSubcategoryRequestDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubcategoryTranslationDto)
  translations?: SubcategoryTranslationDto[];
}
