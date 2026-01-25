import { FileType } from '@prisma/client';

export const FILE_TYPE_MIME_MAP: Record<FileType, string[]> = {
  PDF: ['application/pdf'],
  IMAGE: ['image/jpeg', 'image/png', 'image/webp'],
  WORD: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  CSV: ['text/csv'],
  EXCEL: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  TEXT: ['text/plain'],
  OTHER: [],
};
