import { IsString, IsNotEmpty } from 'class-validator';

export class ContentMetadataDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}