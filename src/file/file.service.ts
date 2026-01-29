import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, FileType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type FileWithMetadata = Prisma.FileAssetGetPayload<{
  include: {
    metadata: true;
  };
}>;

@Injectable()
export class FileService {
  constructor(private readonly prisma: PrismaService) {}

  getPublicUrl(storageKey: string) {
    return `${process.env.APP_URL}/uploads/${storageKey}`;
  }

  private formatFile(file: FileWithMetadata) {
    return {
      id: file.id,
      contentTypeId: file.contentTypeId,
      fileName: file.fileName,
      fileSize: file.fileSize,
      fileType: file.fileType,
      uploadedAt: file.uploadedAt,
      url: this.getPublicUrl(file.storageKey),
      metadata: Object.fromEntries(file.metadata.map((m) => [m.key, m.value])),
    };
  }

  async attachFiles(
    tx: Prisma.TransactionClient,
    contentTypeId: number,
    files: Express.Multer.File[],
    fileType: FileType,
    metadata?: Record<string, string>,
  ) {
    if (!files?.length) return [];

    await tx.fileAsset.createMany({
      data: files.map((file) => ({
        contentTypeId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storageKey: file.filename,
        fileType,
      })),
    });

    const assets = await tx.fileAsset.findMany({
      where: {
        contentTypeId,
        storageKey: {
          in: files.map((f) => f.filename),
        },
      },
      include: { metadata: true },
    });

    if (metadata && Object.keys(metadata).length > 0) {
      const metadataRows: Prisma.FileMetadataCreateManyInput[] = [];

      for (const asset of assets) {
        for (const [key, value] of Object.entries(metadata)) {
          metadataRows.push({
            fileId: asset.id,
            key,
            value,
          });
        }
      }

      await tx.fileMetadata.createMany({
        data: metadataRows,
      });
    }

    return assets;
  }

  async getFilesByContentType(contentTypeId: number) {
    const files = await this.prisma.fileAsset.findMany({
      where: { contentTypeId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        metadata: true,
      },
    });

    return files.map((f) => this.formatFile(f));
  }

  async getAllFiles(params?: {
    contentTypeId?: number;
    type?: FileType;
    skip?: number;
    take?: number;
  }) {
    const { contentTypeId, type, skip = 0, take = 20 } = params || {};

    const where: Prisma.FileAssetWhereInput = {
      ...(contentTypeId && { contentTypeId }),
      ...(type && { fileType: type }),
    };

    const [files, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        include: { metadata: true },
        skip,
        take,
        orderBy: { uploadedAt: 'desc' },
      }),
      this.prisma.fileAsset.count({ where }),
    ]);
    return { files: files.map((f) => this.formatFile(f)), total };
  }

  async getFilesBySubcategory(
    subcategoryId: number,
    params?: {
      skip?: number;
      take?: number;
      type?: FileType;
    },
  ) {
    const { skip = 0, take = 20, type } = params || {};

    const where: Prisma.FileAssetWhereInput = {
      ...(type && { fileType: type }),
      contentType: {
        subcategoryId,
      },
    };

    const [files, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        include: { metadata: true },
        orderBy: { uploadedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.fileAsset.count({ where }),
    ]);

    return {
      files: files.map((f) => this.formatFile(f)),
      total,
    };
  }

  async deleteFile(id: number) {
    const file = await this.prisma.fileAsset.findUnique({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    await this.prisma.$transaction([
      this.prisma.fileMetadata.deleteMany({
        where: { fileId: id },
      }),
      this.prisma.fileAsset.delete({
        where: { id },
      }),
    ]);

    return {
      success: true,
      deletedId: id,
      message: 'File deleted successfully',
    };
  }
}
