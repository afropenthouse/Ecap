import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { Readable } from 'stream';
import cloudinary from '../config/cloudinary';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // General image uploads: 10 MB; organization logos are further limited below.
});

const uploadSingleImage = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, error => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Image exceeds the 10 MB upload limit' });
    }
    if (error) return res.status(400).json({ error: 'Unable to process uploaded image' });
    next();
  });
};

router.post(
  '/image',
  authMiddleware,
  uploadSingleImage,
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const requestedFolder = (req.body.folder as string) || '';
      const isOrganizationLogo = requestedFolder === 'organization-logos' || requestedFolder.endsWith('/organization-logos');
      if (isOrganizationLogo) {
        if (req.user?.role !== 'HR') return res.status(403).json({ error: 'Only HR can update the company logo' });
        if (file.size > 5 * 1024 * 1024) return res.status(413).json({ error: 'Company logos must be 5 MB or smaller' });
        const isJpeg = file.mimetype === 'image/jpeg' && file.buffer.length >= 3 && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
        const isPng = file.mimetype === 'image/png' && file.buffer.length >= 8 && file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        if (!isJpeg && !isPng) return res.status(415).json({ error: 'Company logos must be a valid JPEG or PNG image' });
      }

      const folderBase = `hrmoffice/${req.user?.organizationId || 'global'}`;
      const folder = isOrganizationLogo ? `${folderBase}/organization-logos` : requestedFolder || `${folderBase}/uploads`;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            return res.status(500).json({ error: 'Cloudinary upload failed', details: error?.message });
          }
          return res.json({
            url: result.secure_url,
            public_id: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
            folder,
          });
        }
      );

      const readable = new Readable();
      readable.push(file.buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return res.status(500).json({ error: 'Unexpected error', details: message });
    }
  }
);

export default router;
