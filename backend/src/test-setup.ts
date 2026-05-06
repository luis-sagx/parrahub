// Global test setup
jest.setTimeout(10000);

// Mock uuid globally
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234-5678',
}));

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    sismember: jest.fn().mockResolvedValue(0),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  HeadBucketCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  CreateBucketCommand: jest.fn(),
  PutBucketPolicyCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.example.com'),
}));

// Silence Logger in tests
jest.spyOn(require('@nestjs/common').Logger.prototype, 'log').mockImplementation(() => {});
jest.spyOn(require('@nestjs/common').Logger.prototype, 'error').mockImplementation(() => {});
jest.spyOn(require('@nestjs/common').Logger.prototype, 'warn').mockImplementation(() => {});