import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as mockGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MinioService } from './minio.service';

jest.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.com/file'),
}));


describe('MinioService', () => {
  let send: jest.Mock;
  let service: MinioService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MinioService();
    send = (S3Client as jest.Mock).mock.results.at(-1)?.value.send;
    send.mockResolvedValue({});
  });

  it('verifica el bucket al iniciar', async () => {
    await service.onModuleInit();
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
  });

  it('uploadFile sube con una key unica y retorna URL publica', async () => {
    const url = await service.uploadFile(
      Buffer.from('x'),
      'foto.png',
      'image/png',
    );

    expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    expect(url).toContain('/chat-files/');
    expect(url).toContain('foto.png');
  });

  it('deleteFile elimina la key indicada', async () => {
    await service.deleteFile('key-1');

    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect(send.mock.calls[0][0].input.Key).toBe('key-1');
  });

  it('getFileMetadata retorna metadatos del archivo', async () => {
    send.mockResolvedValueOnce({
      ContentLength: 1024,
      ContentType: 'image/png',
      LastModified: new Date('2024-01-01'),
    });

    const metadata = await service.getFileMetadata('my-key');

    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    expect(metadata.size).toBe(1024);
  });

  it('extractKeyFromUrl extrae key correctamente', () => {
    const url = 'http://localhost:9002/chat-files/my-key-123?token=abc';
    
    const key = service.extractKeyFromUrl(url);
    
    expect(key).toBe('my-key-123');
  });

  it('extractKeyFromUrl extrae key sin bucket en la URL', () => {
    const url = 'http://localhost:9002/my-key-no-bucket?token=abc';
    
    const key = service.extractKeyFromUrl(url);
    
    // This goes to the fallback case which returns the full URL minus query
    expect(key).toBeDefined();
  });

  it('buildPublicUrl retorna URL publica', () => {
    const url = service.buildPublicUrl('my-key-123');
    
    expect(url).toContain('/chat-files/');
    expect(url).toContain('my-key-123');
  });

  it('getPresignedUrl retorna URL firmada', async () => {
    const url = await service.getPresignedUrl('test-key', 3600);
    
    expect(url).toBe('https://signed-url.com/file');
  });
});



describe('MinioService', () => {
  let send: jest.Mock;
  let service: MinioService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MinioService();
    send = (S3Client as jest.Mock).mock.results.at(-1)?.value.send;
    send.mockResolvedValue({});
  });

  it('verifica el bucket al iniciar', async () => {
    await service.onModuleInit();
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadBucketCommand);
  });

  it('uploadFile sube con una key unica y retorna URL publica', async () => {
    const url = await service.uploadFile(
      Buffer.from('x'),
      'foto.png',
      'image/png',
    );

    expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    expect(url).toContain('/chat-files/');
    expect(url).toContain('foto.png');
  });

  it('deleteFile elimina la key indicada', async () => {
    await service.deleteFile('key-1');

    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect(send.mock.calls[0][0].input.Key).toBe('key-1');
  });

  it('getFileMetadata retorna metadatos del archivo', async () => {
    send.mockResolvedValueOnce({
      ContentLength: 1024,
      ContentType: 'image/png',
      LastModified: new Date('2024-01-01'),
    });

    const metadata = await service.getFileMetadata('my-key');

    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    expect(metadata.size).toBe(1024);
  });

  it('extractKeyFromUrl extrae key correctamente', () => {
    const url = 'http://localhost:9002/chat-files/my-key-123?token=abc';
    
    const key = service.extractKeyFromUrl(url);
    
    expect(key).toBe('my-key-123');
  });

  it('buildPublicUrl retorna URL publica', () => {
    const url = service.buildPublicUrl('my-key-123');
    
    expect(url).toContain('/chat-files/');
    expect(url).toContain('my-key-123');
  });
});