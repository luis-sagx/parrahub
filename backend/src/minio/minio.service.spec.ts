import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { MinioService } from './minio.service';

jest.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  };
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
});
