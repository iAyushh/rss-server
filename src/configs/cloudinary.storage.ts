import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from './cloudinary.config';

export const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isPdf = file.mimetype === 'application/pdf';

    const baseName = file.originalname.replace(/\.[^/.]+$/, '');

    return {
      folder: 'rss-uploads',
      resource_type: isPdf ? 'raw' : 'auto',
      public_id: baseName,
      access_mode: 'public',
      overwrite: true,
    };
  },
});
