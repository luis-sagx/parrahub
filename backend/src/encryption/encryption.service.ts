import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private key: Buffer;

  onModuleInit() {
    // Tomar solo los primeros 64 caracteres hex después de limpiar
    const keyHex = (process.env.MESSAGE_ENCRYPTION_KEY || '')
      .replace(/[^0-9a-fA-F]/g, '')
      .substring(0, 64);

    if (!keyHex) {
      throw new Error(
        'MESSAGE_ENCRYPTION_KEY no está configurada en las variables de entorno',
      );
    }

    if (keyHex.length !== 64) {
      throw new Error(
        `MESSAGE_ENCRYPTION_KEY debe tener exactamente 64 caracteres (256 bits en hex), tiene: ${keyHex.length}`,
      );
    }

    this.key = Buffer.from(keyHex, 'hex');
    this.logger.log('EncryptionService inicializado con AES-256-GCM');
  }

  /**
   * Encripta un texto plano usando AES-256-GCM.
   * El resultado incluye: IV(16) + authTag(16) + ciphertext (variable)
   * Formato de retorno: Base64(IV + authTag + ciphertext)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return plaintext;
    }

    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv, {
      authTagLength: this.authTagLength,
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Combinar: IV + authTag + ciphertext
    const result = Buffer.concat([iv, authTag, encrypted]);
    return result.toString('base64');
  }

  /**
   * Desencripta texto encriptado por encrypt().
   * Input: Base64(IV + authTag + ciphertext)
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) {
      return encryptedData;
    }

    try {
      const data = Buffer.from(encryptedData, 'base64');

      // Extraer componentes
      const iv = data.subarray(0, this.ivLength);
      const authTag = data.subarray(
        this.ivLength,
        this.ivLength + this.authTagLength,
      );
      const ciphertext = data.subarray(this.ivLength + this.authTagLength);

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv, {
        authTagLength: this.authTagLength,
      });
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error('Error al desencriptar mensaje:', error);
      // En caso de error, retornar el texto original (para mensajes viejos sin encriptar)
      return encryptedData;
    }
  }
}
