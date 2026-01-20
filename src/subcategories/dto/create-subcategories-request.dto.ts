import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubcategoryTranslationDto } from './subcategory-translation.dto';

export class CreateSubcategoryRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty()
  @IsInt()
  categoryId: number;

  @ApiProperty({ type: [SubcategoryTranslationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubcategoryTranslationDto)
  translations: SubcategoryTranslationDto[];
}
