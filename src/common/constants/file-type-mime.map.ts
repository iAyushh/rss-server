import { FileType } from '@prisma/client';

export const FILE_TYPE_MIME_MAP: Record<FileType, string[]> = {
  PDF: ['application/pdf'],

  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],

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

  AUDIO: [
    'audio/mpeg', // mp3
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    'audio/mp4', // m4a
  ],

  VIDEO: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime', // mov
    'video/x-msvideo', // avi
    'video/x-matroska', // mkv
  ],

  OTHER: [], // fallback (no validation)
};
