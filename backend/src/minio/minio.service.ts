import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export interface StoredFileMetadata {
  size?: number;
  contentType?: string;
  lastModified?: Date;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: S3Client;
  private readonly bucket = process.env.MINIO_BUCKET || 'chat-files';
  private readonly endpoint = process.env.MINIO_ENDPOINT || 'localhost';
  private readonly port = process.env.MINIO_PORT || '9000';
  private readonly useSsl = process.env.MINIO_USE_SSL === 'true';

  constructor() {
    const protocol = this.useSsl ? 'https' : 'http';
    this.client = new S3Client({
      endpoint: `${protocol}://${this.endpoint}:${this.port}`,
      region: process.env.MINIO_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    await this.ensureBucket();
  }

  async uploadFile(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    const key = this.createObjectKey(filename);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    return this.getPublicUrl(key);
  }

  async getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expirySeconds },
    );
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async getFileMetadata(key: string): Promise<StoredFileMetadata> {
    const result = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return {
      size: result.ContentLength,
      contentType: result.ContentType,
      lastModified: result.LastModified,
    };
  }

  extractKeyFromUrl(url: string): string {
    const marker = `/${this.bucket}/`;
    const [, key] = url.split(marker);
    return key || url;
  }

  private async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket MinIO listo: ${this.bucket}`);
      return;
    } catch {
      this.logger.warn(`Bucket ${this.bucket} no existe, creando...`);
    }

    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucket}/*`],
              },
            ],
          }),
        }),
      );
      this.logger.log(`Bucket MinIO creado: ${this.bucket}`);
    } catch (error) {
      this.logger.error('No se pudo preparar MinIO', error);
      throw new InternalServerErrorException('MinIO no disponible');
    }
  }

  private createObjectKey(filename: string): string {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${Date.now()}-${uuidv4()}-${safeName}`;
  }

  private getPublicUrl(key: string): string {
    const publicEndpoint =
      process.env.MINIO_PUBLIC_ENDPOINT || `${this.endpoint}:${this.port}`;
    const protocol = this.useSsl ? 'https' : 'http';
    return `${protocol}://${publicEndpoint}/${this.bucket}/${key}`;
  }
}
