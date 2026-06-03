import type { Request } from 'express';
import type { AuthPayload } from '../lib/auth';
import type { AccessScope } from '../lib/access-control';

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthPayload;
    accessScope?: AccessScope;
  }
}
