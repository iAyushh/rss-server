import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, FileType, FileAsset, FileMetadata } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FileService {
  constructor(private readonly prisma: PrismaService) {}

  getPublicUrl(storageKey: string) {
    return `${process.env.APP_URL}/uploads/${storageKey}`;
  }

  async attachFiles(
    prisma: Prisma.TransactionClient,
    contentTypeId: number,
    files: Express.Multer.File[],
    fileType: FileType,
    metadata?: Record<string, string>,
  ) {
    await prisma.fileAsset.createMany({
      data: files.map((file) => ({
        contentTypeId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storageKey: file.filename,
        fileType,
      })),
    });

    const assets = await prisma.fileAsset.findMany({
      where: { contentTypeId },
      orderBy: { uploadedAt: 'desc' },
    });

    // Save metadata (if provided)
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

      await prisma.fileMetadata.createMany({
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

    return files.map((file: FileAsset & { metadata: FileMetadata[] }) => ({
      id: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      fileType: file.fileType,
      uploadedAt: file.uploadedAt,
      url: this.getPublicUrl(file.storageKey),
      metadata: Object.fromEntries(
        file.metadata.map((m: FileMetadata) => [m.key, m.value]),
      ),
    }));
  }

  async getAllFiles(contentTypeId?: number) {
    const files = await this.prisma.fileAsset.findMany({
      where: contentTypeId ? { contentTypeId } : undefined,
      orderBy: { uploadedAt: 'desc' },
      include: {
        metadata: true,
      },
    });

    return files.map((file: FileAsset & { metadata: FileMetadata[] }) => ({
      id: file.id,
      contentTypeId: file.contentTypeId,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      fileType: file.fileType,
      uploadedAt: file.uploadedAt,
      url: this.getPublicUrl(file.storageKey),
      metadata: Object.fromEntries(file.metadata.map((m) => [m.key, m.value])),
    }));
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
      message: 'File deleted successfully',
    };
  }
}
