import { IsOptional, IsString } from 'class-validator';

export class CategoryTranslationDto {
  @IsString()
  languageCode: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
