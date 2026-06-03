import type { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../lib/auth';
import { config } from '../config';
import { HttpError } from '../errors';

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
  if (!token) {
    throw new HttpError(401, 'Authentication required');
  }

  const payload = verifyAuthToken(token, config.authTokenSecret);
  if (!payload) {
    throw new HttpError(401, 'Invalid or expired authentication token');
  }

  req.authUser = payload;
  next();
}

