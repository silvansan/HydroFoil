import { describe, expect, it } from 'vitest';

import { decryptStorageSecret, encryptStorageSecret } from './storage-secrets';

describe('storage secret helpers', () => {
  it('encrypts and decrypts storage credentials with a stable key', () => {
    const encrypted = encryptStorageSecret('secret-value', 'test-secret-key');

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe('secret-value');
    expect(encrypted?.startsWith('enc:v1:')).toBe(true);
    expect(decryptStorageSecret(encrypted, 'test-secret-key')).toBe('secret-value');
  });

  it('keeps plaintext dev credentials readable for backwards compatibility', () => {
    expect(encryptStorageSecret('plain-value', '')).toBe('plain-value');
    expect(decryptStorageSecret('plain-value', '')).toBe('plain-value');
  });

  it('requires the configured key for encrypted credentials', () => {
    const encrypted = encryptStorageSecret('secret-value', 'test-secret-key');

    expect(() => decryptStorageSecret(encrypted, '')).toThrow(
      'STORAGE_SECRET_KEY is required to decrypt storage credentials'
    );
  });
});
