import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FileTranslationDto } from './update-file-request.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFileRequestDto {
    @ApiProperty()
    @IsString()
    storageKey!: string;

    @ApiProperty()
    @IsString()
    mimeType!: string;

    @ApiProperty()
    @IsInt()
    fileSize!: number;

    @ApiProperty()
    @IsString()
    @IsOptional()
    originalName?: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    url?: string;

    @ApiProperty()
    @IsString()
    @IsOptional()
    eventName?: string;

    @ApiProperty()
    @IsInt()
    @IsOptional()
    contentYear?: number;

    @ApiProperty({ required: false })
    @IsInt()
    @IsOptional()
    contentTypeId?: number;

    @ApiProperty({ required: true })
    @IsInt()
    parentId!: number;

    @ApiProperty()
    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    tags?: string[];

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    languageCode?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    displayName?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;
}

export class BulkCreateFilesDto {
    @ApiProperty({ type: [CreateFileRequestDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateFileRequestDto)
    files!: CreateFileRequestDto[];
}
