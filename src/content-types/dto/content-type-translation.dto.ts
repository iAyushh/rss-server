import { IsString, IsOptional } from 'class-validator';

export class ContentTypeTranslationDto {
  @IsString()
  languageCode: string; // 'hi' | 'en'

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
