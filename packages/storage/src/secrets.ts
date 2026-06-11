import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';

function keyFromSecret(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encryptStorageSecret(value: string | undefined, secretKey: string): string | undefined {
  if (!value) return undefined;
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('STORAGE_SECRET_KEY is required to encrypt storage credentials in production');
    }
    return value;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromSecret(secretKey), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString('base64url')}`;
}

export function decryptStorageSecret(value: string | undefined, secretKey: string): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;
  if (!secretKey) {
    throw new Error('STORAGE_SECRET_KEY is required to decrypt storage credentials');
  }

  const payload = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64url');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);

  const decipher = createDecipheriv('aes-256-gcm', keyFromSecret(secretKey), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
