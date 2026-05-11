import { EncryptionService } from './encryption.service';

const VALID_KEY_HEX = 'a'.repeat(64); // 64 hex chars = 256-bit key

function buildService(key?: string): EncryptionService {
  const svc = new EncryptionService();
  if (key !== undefined) {
    process.env.MESSAGE_ENCRYPTION_KEY = key;
  }
  svc.onModuleInit();
  return svc;
}

describe('EncryptionService', () => {
  const originalEnv = process.env.MESSAGE_ENCRYPTION_KEY;

  afterEach(() => {
    process.env.MESSAGE_ENCRYPTION_KEY = originalEnv;
  });

  // ─── onModuleInit ────────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('initializes correctly with a valid 64-char hex key', () => {
      const svc = new EncryptionService();
      process.env.MESSAGE_ENCRYPTION_KEY = VALID_KEY_HEX;
      expect(() => svc.onModuleInit()).not.toThrow();
    });

    it('throws when MESSAGE_ENCRYPTION_KEY is not set', () => {
      const svc = new EncryptionService();
      delete process.env.MESSAGE_ENCRYPTION_KEY;
      expect(() => svc.onModuleInit()).toThrow(
        'MESSAGE_ENCRYPTION_KEY no está configurada',
      );
    });

    it('throws when MESSAGE_ENCRYPTION_KEY is an empty string', () => {
      const svc = new EncryptionService();
      process.env.MESSAGE_ENCRYPTION_KEY = '';
      expect(() => svc.onModuleInit()).toThrow(
        'MESSAGE_ENCRYPTION_KEY no está configurada',
      );
    });

    it('throws when key has fewer than 64 valid hex chars', () => {
      const svc = new EncryptionService();
      process.env.MESSAGE_ENCRYPTION_KEY = 'a'.repeat(32); // 32 hex chars → too short
      expect(() => svc.onModuleInit()).toThrow(
        'MESSAGE_ENCRYPTION_KEY debe tener exactamente 64 caracteres',
      );
    });

    it('strips non-hex characters and still works if result is 64 chars', () => {
      // Insert dashes/spaces that get stripped — result is still 64 valid hex chars
      const withDashes = VALID_KEY_HEX.split('').join('-'); // 'a-a-a-...'
      const svc = new EncryptionService();
      process.env.MESSAGE_ENCRYPTION_KEY = withDashes;
      expect(() => svc.onModuleInit()).not.toThrow();
    });

    it('truncates to first 64 hex chars when key is longer than 64', () => {
      const svc = new EncryptionService();
      process.env.MESSAGE_ENCRYPTION_KEY = 'a'.repeat(128); // 128 → truncated to 64
      expect(() => svc.onModuleInit()).not.toThrow();
    });
  });

  // ─── encrypt ─────────────────────────────────────────────────────────────────

  describe('encrypt', () => {
    let svc: EncryptionService;

    beforeEach(() => {
      svc = buildService(VALID_KEY_HEX);
    });

    it('returns a non-empty base64 string', () => {
      const result = svc.encrypt('Hello, world!');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns a different ciphertext each call (random IV)', () => {
      const a = svc.encrypt('same-text');
      const b = svc.encrypt('same-text');
      expect(a).not.toBe(b);
    });

    it('returns the input unchanged when plaintext is empty string', () => {
      expect(svc.encrypt('')).toBe('');
    });

    it('returns the input unchanged when plaintext is falsy (null-like cast)', () => {
      // TypeScript does not allow null but JS callers might pass it
      expect(svc.encrypt(null as unknown as string)).toBeNull();
    });

    it('encrypts unicode content correctly', () => {
      const result = svc.encrypt('Hola 🌎 ñoño');
      expect(result).not.toBe('Hola 🌎 ñoño');
    });

    it('produces a valid base64-encoded output', () => {
      const result = svc.encrypt('test');
      expect(() => Buffer.from(result, 'base64')).not.toThrow();
    });
  });

  // ─── decrypt ─────────────────────────────────────────────────────────────────

  describe('decrypt', () => {
    let svc: EncryptionService;

    beforeEach(() => {
      svc = buildService(VALID_KEY_HEX);
    });

    it('round-trips: decrypt(encrypt(text)) === text', () => {
      const plaintext = 'Hello, ParrHub!';
      expect(svc.decrypt(svc.encrypt(plaintext))).toBe(plaintext);
    });

    it('round-trips unicode content', () => {
      const plaintext = '¡Hola! 🎉 señor';
      expect(svc.decrypt(svc.encrypt(plaintext))).toBe(plaintext);
    });

    it('returns input unchanged when encryptedData is empty string', () => {
      expect(svc.decrypt('')).toBe('');
    });

    it('returns input unchanged when encryptedData is falsy (null-like cast)', () => {
      expect(svc.decrypt(null as unknown as string)).toBeNull();
    });

    it('returns the corrupted input on decryption error (legacy messages)', () => {
      // Random non-encrypted string → error caught → return original
      const junk = 'this-is-not-encrypted-data';
      const result = svc.decrypt(junk);
      expect(result).toBe(junk);
    });

    it('returns corrupted base64 input on auth-tag mismatch', () => {
      // Valid base64 but wrong content → GCM auth tag mismatch
      const fakeEncrypted = Buffer.alloc(48).toString('base64'); // 16 IV + 16 tag + 16 ct (all zeros)
      const result = svc.decrypt(fakeEncrypted);
      // Should return original (error fallback)
      expect(result).toBe(fakeEncrypted);
    });

    it('decrypts long messages correctly', () => {
      const longText = 'x'.repeat(900);
      expect(svc.decrypt(svc.encrypt(longText))).toBe(longText);
    });
  });
});
