import { FileType } from '@prisma/client';

export type NormalizedFileInput = {
  displayName: string;
  description?: string;
  originalName: string;
  storageKey: string;
  mimeType: string;
  extension: string;
  fileSize: number;
  fileType: FileType;
};
