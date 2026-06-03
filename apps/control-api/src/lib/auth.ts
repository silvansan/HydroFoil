import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);
const TOKEN_ALGORITHM = 'sha256';
const TOKEN_SEPARATOR = '.';

export type AuthPayload = {
  userId: string;
  organizationId: string;
  email: string;
  role: 'super-admin' | 'admin' | 'manager';
  exp: number;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  const [salt, key] = hashed.split(':');
  if (!salt || !key) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derived);
}

function base64urlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

export function signAuthToken(payload: AuthPayload, secret: string): string {
  const body = JSON.stringify(payload);
  const encoded = base64urlEncode(body);
  const signature = crypto
    .createHmac(TOKEN_ALGORITHM, secret)
    .update(encoded)
    .digest('base64');
  return `${encoded}${TOKEN_SEPARATOR}${base64urlEncode(signature)}`;
}

export function verifyAuthToken(token: string, secret: string): AuthPayload | null {
  const parts = token.split(TOKEN_SEPARATOR);
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = crypto
    .createHmac(TOKEN_ALGORITHM, secret)
    .update(encoded)
    .digest('base64');
  const expectedSignature = base64urlEncode(expected);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }
  try {
    const body = base64urlDecode(encoded);
    const payload = JSON.parse(body) as AuthPayload;
    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
