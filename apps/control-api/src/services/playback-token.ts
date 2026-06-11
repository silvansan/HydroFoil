import { createHmac, timingSafeEqual } from 'node:crypto';

export interface PlaybackTokenPayload {
  organizationId: string;
  app: string;
  stream: string;
  exp: number;
  /** Generation counter; missing on legacy tokens is treated as 0. */
  gen?: number;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export class PlaybackTokenService {
  constructor(private readonly secret: string) {}

  issueToken(payload: PlaybackTokenPayload): string {
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = createHmac('sha256', this.secret).update(encodedPayload).digest('base64url');
    return `${encodedPayload}.${signature}`;
  }

  verifyToken(token: string): PlaybackTokenPayload | null {
    const [encodedPayload, encodedSignature] = token.split('.');
    if (!encodedPayload || !encodedSignature) {
      return null;
    }

    const expectedSignature = createHmac('sha256', this.secret)
      .update(encodedPayload)
      .digest('base64url');

    const provided = Buffer.from(encodedSignature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return null;
    }

    try {
      const payload = JSON.parse(base64UrlDecode(encodedPayload)) as PlaybackTokenPayload;
      if (!payload.organizationId || !payload.app || !payload.stream || !payload.exp) {
        return null;
      }
      if (payload.exp * 1000 <= Date.now()) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }
}
