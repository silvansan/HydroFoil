import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VodPlaybackTokenPayload {
  organizationId: string;
  routeId: string;
  exp: number;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export class VodPlaybackTokenService {
  constructor(private readonly secret: string) {}

  issueToken(payload: VodPlaybackTokenPayload): string {
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = createHmac('sha256', this.secret).update(encodedPayload).digest('base64url');
    return `${encodedPayload}.${signature}`;
  }

  verifyToken(token: string): VodPlaybackTokenPayload | null {
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
      const payload = JSON.parse(base64UrlDecode(encodedPayload)) as VodPlaybackTokenPayload;
      if (!payload.organizationId || !payload.routeId || !payload.exp) {
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
