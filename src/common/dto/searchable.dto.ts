import { IsOptional, IsString, IsNumber } from 'class-validator';

export class SearchablePaginatedDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  languageCode?: string;

  @IsOptional()
  @IsNumber()
  skip?: number;

  @IsOptional()
  @IsNumber()
  take?: number;
}
