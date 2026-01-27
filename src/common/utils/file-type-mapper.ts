import { FileType } from '@prisma/client';

export function mapMimeToFileType(mime: string): FileType {
  if (mime.startsWith('image/')) return FileType.IMAGE;
  if (mime === 'application/pdf') return FileType.PDF;
  if (mime.includes('word')) return FileType.WORD;
  if (mime === 'text/plain') return FileType.TEXT;
  if (mime === 'text/csv') return FileType.CSV;
  return FileType.OTHER;
}
