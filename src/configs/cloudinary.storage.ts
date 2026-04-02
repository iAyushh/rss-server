
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinary.config';

export const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'rss-uploads',
    resource_type: 'auto',
  }) as any,
});