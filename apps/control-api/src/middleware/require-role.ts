import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../errors';
import type { AuthPayload } from '../lib/auth';

export type UserRole = AuthPayload['role'];

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.authUser?.role;
    if (!role || !roles.includes(role)) {
      throw new HttpError(403, 'Insufficient permissions');
    }
    next();
  };
}

export function assertRoleAssignable(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === 'admin' && targetRole === 'super-admin') {
    throw new HttpError(403, 'Admins cannot assign the super-admin role');
  }
}

export function assertUserMutable(actorRole: UserRole, targetRole: UserRole) {
  if (actorRole === 'admin' && targetRole === 'super-admin') {
    throw new HttpError(403, 'Admins cannot modify super-admin accounts');
  }
}
