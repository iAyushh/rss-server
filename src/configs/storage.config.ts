import { registerAs } from '@nestjs/config';

export const storageConfigFactory = registerAs('storage', () => ({
  diskDestination: process.env.STORAGE_DIR,
  url: process.env.STORAGE_URL,
  maxFileSize: 100000000, // 100000000 Bytes = 100 MB
  fileExtensions: [
    '.png',
    '.jpg',
    '.jpeg',
    '.pdf',
    '.docx',
    '.txt',
    '.csv',
    '.xls',
    '.xlsx',
    '.mp3',
    '.wav',
    '.aac',
    '.ogg',
    '.flac',
    '.m4a',
    '.mp4',
    '.webm',
    '.mov',
    '.avi',
    '.mkv',
  ],
}));
