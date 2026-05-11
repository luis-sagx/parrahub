import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  const validKey = '0'.repeat(64);

  beforeEach(() => {
    process.env.MESSAGE_ENCRYPTION_KEY = validKey;
    service = new EncryptionService();
    service.onModuleInit();
  });

  afterEach(() => {
    delete process.env.MESSAGE_ENCRYPTION_KEY;
  });

  describe('onModuleInit', () => {
    it('should initialize without throwing when key is valid', () => {
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('should throw when key is empty string', () => {
      process.env.MESSAGE_ENCRYPTION_KEY = '';
      const s = new EncryptionService();
      expect(() => s.onModuleInit()).toThrow(
        'MESSAGE_ENCRYPTION_KEY no está configurada en las variables de entorno',
      );
    });

    it('should throw when key env var is not set', () => {
      delete process.env.MESSAGE_ENCRYPTION_KEY;
      const s = new EncryptionService();
      expect(() => s.onModuleInit()).toThrow(
        'MESSAGE_ENCRYPTION_KEY no está configurada en las variables de entorno',
      );
    });

    it('should throw when key has fewer than 64 hex chars', () => {
      process.env.MESSAGE_ENCRYPTION_KEY = 'a'.repeat(30);
      const s = new EncryptionService();
      expect(() => s.onModuleInit()).toThrow(
        'MESSAGE_ENCRYPTION_KEY debe tener exactamente 64 caracteres',
      );
    });

    it('should strip non-hex characters and accept clean 64-char key', () => {
      process.env.MESSAGE_ENCRYPTION_KEY = '0'.repeat(64) + '!@#$';
      const s = new EncryptionService();
      expect(() => s.onModuleInit()).not.toThrow();
    });
  });

  describe('encrypt', () => {
    it('should return empty string unchanged', () => {
      expect(service.encrypt('')).toBe('');
    });

    it('should return null unchanged', () => {
      expect(service.encrypt(null as any)).toBeNull();
    });

    it('should return a base64 string for normal input', () => {
      const result = service.encrypt('hello world');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should produce different ciphertext each call due to random IV', () => {
      const r1 = service.encrypt('same text');
      const r2 = service.encrypt('same text');
      expect(r1).not.toBe(r2);
    });

    it('should produce output at least 32 bytes larger than input (IV + authTag)', () => {
      const input = 'test';
      const result = service.encrypt(input);
      const decoded = Buffer.from(result, 'base64');
      expect(decoded.length).toBeGreaterThan(32);
    });
  });

  describe('decrypt', () => {
    it('should return empty string unchanged', () => {
      expect(service.decrypt('')).toBe('');
    });

    it('should return null unchanged', () => {
      expect(service.decrypt(null as any)).toBeNull();
    });

    it('should decrypt back to the original plaintext', () => {
      const original = 'hello world';
      const encrypted = service.encrypt(original);
      expect(service.decrypt(encrypted)).toBe(original);
    });

    it('should handle unicode and emojis correctly', () => {
      const original = '¡Hola! 🎉 Ünïcödé texto';
      const encrypted = service.encrypt(original);
      expect(service.decrypt(encrypted)).toBe(original);
    });

    it('should handle long messages (1000 chars)', () => {
      const original = 'a'.repeat(1000);
      const encrypted = service.encrypt(original);
      expect(service.decrypt(encrypted)).toBe(original);
    });

    it('should return original data when decryption fails (invalid ciphertext)', () => {
      const invalid = 'this-is-not-valid-base64-ciphertext';
      expect(service.decrypt(invalid)).toBe(invalid);
    });

    it('should return original data when auth tag is tampered', () => {
      const encrypted = service.encrypt('sensitive data');
      const buf = Buffer.from(encrypted, 'base64');
      buf[16] ^= 0xff; // corrupt the first byte of authTag
      const tampered = buf.toString('base64');
      const result = service.decrypt(tampered);
      expect(result).toBe(tampered);
    });
  });
});
