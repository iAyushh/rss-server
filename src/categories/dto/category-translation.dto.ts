import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CategoryTranslationDto {
  @ApiProperty()
  @IsString()
  languageCode!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  description?: string;
}
