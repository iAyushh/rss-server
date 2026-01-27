import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SubcategoryTranslationDto } from './subcategory-translation.dto';

export class CreateSubcategoryRequestDto {
  @ApiProperty()
  @IsInt()
  categoryId: number;

  @ApiProperty({ type: [SubcategoryTranslationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubcategoryTranslationDto)
  translations: SubcategoryTranslationDto[];
}
