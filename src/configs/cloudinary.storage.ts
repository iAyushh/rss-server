
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinary.config';

export const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isPdf = file.mimetype === 'application/pdf';

    return {
      folder: 'rss-uploads',
      resource_type: isPdf ? 'raw' : 'auto',
      access_mode: 'public',
    };
  },
});