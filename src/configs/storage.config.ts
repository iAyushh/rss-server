import { registerAs } from '@nestjs/config';

export const storageConfigFactory = registerAs('storage', () => ({
  
  provider: 's3',
  bucket: process.env.AWS_BUCKET_NAME,
  region: process.env.AWS_REGION,

 
  baseUrl: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`,

  maxFileSize: 100000000, // 100 MB

  allowedExtensions: [
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
    '.aiff',
    '.aac',
    '.ogg',
    '.flac',
    '.m4a',
    '.mp4',
    '.webm',
    '.mov',
    '.avi',
    '.mkv',
    '.m4b',
    '.dss',
    '.dsf',
    '.diff',
    '.opus',
  ],
}));