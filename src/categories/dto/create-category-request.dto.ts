import { IsString, IsOptional, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryRequestDto {
  @ApiProperty({ description: 'Language code (e.g. hi, en)' })
  @IsString()
  languageCode!: string;

  @ApiProperty({ description: 'Name of the category' })
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, description: 'Optional Parent ID for nested Geographic Units' })
  @IsOptional()
  @IsInt()
  parentId?: number;

  @ApiProperty({ required: false, description: 'Depth level (1 = Prant, 2 = Vibhag, 3 = Jila...)' })
  @IsOptional()
  @IsInt()
  level?: number;
}
