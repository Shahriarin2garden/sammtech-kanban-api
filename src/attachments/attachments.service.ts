import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    cloudinary.config({
      cloud_name: config.get('CLOUDINARY_CLOUD_NAME', 'dev'),
      api_key: config.get('CLOUDINARY_API_KEY', 'dev'),
      api_secret: config.get('CLOUDINARY_API_SECRET', 'dev'),
    });
  }

  async upload(taskId: string, file: Express.Multer.File) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
    });
    if (!task) throw new NotFoundException('Task not found');

    let fileUrl: string;
    const isDev = this.config.get('CLOUDINARY_CLOUD_NAME') === 'dev';

    if (isDev) {
      fileUrl = `http://localhost:3000/uploads/${file.originalname}`;
    } else {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'kanban', resource_type: 'auto' },
          (err, result) => {
            if (err) reject(err);
            else if (!result) reject(new Error('Upload returned no result'));
            else resolve(result);
          },
        );
        stream.end(file.buffer);
      });
      fileUrl = result.secure_url;
    }

    return this.prisma.attachment.create({
      data: {
        taskId,
        fileName: file.originalname,
        fileUrl,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  }
}
