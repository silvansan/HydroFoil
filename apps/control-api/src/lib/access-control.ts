import type { Request } from 'express';
import type { AuthPayload } from './auth';
import type { Repositories } from '@hydrofoil/db';
import { ForbiddenError, NotFoundError } from '../errors';

export type UserRole = AuthPayload['role'];

export type AccessScope = {
  role: UserRole;
  /** null = all applications (admin / super-admin). */
  applicationIds: string[] | null;
  /** null = all recording policies for attach; non-empty = restricted list. */
  recordingPolicyIds: string[] | null;
  /** null = all VOD routes for admin; non-empty = restricted list for managers. */
  vodRouteIds: string[] | null;
  /** null = all domain blocks for admin; non-empty = restricted list for managers. */
  domainBlockIds: string[] | null;
  /** null = all storage locations for admin; non-empty = restricted list for managers. */
  storageLocationIds: string[] | null;
};

export function bypassesApplicationScope(role: UserRole): boolean {
  return role === 'super-admin' || role === 'admin';
}

export async function loadAccessScope(
  organizationId: string,
  authUser: AuthPayload,
  repos: Repositories
): Promise<AccessScope> {
  if (bypassesApplicationScope(authUser.role)) {
    return {
      role: authUser.role,
      applicationIds: null,
      recordingPolicyIds: null,
      vodRouteIds: null,
      domainBlockIds: null,
      storageLocationIds: null,
    };
  }

  const [
    applicationIds,
    recordingPolicyIds,
    vodRouteIds,
    domainBlockIds,
    storageLocationIds,
  ] = await Promise.all([
    repos.userAccess.listApplicationIds(organizationId, authUser.userId),
    repos.userAccess.listRecordingPolicyIds(organizationId, authUser.userId),
    repos.userAccess.listVodRouteIds(organizationId, authUser.userId),
    repos.userAccess.listDomainBlockIds(organizationId, authUser.userId),
    repos.userAccess.listStorageLocationIds(organizationId, authUser.userId),
  ]);

  return {
    role: authUser.role,
    applicationIds,
    recordingPolicyIds: recordingPolicyIds.length > 0 ? recordingPolicyIds : null,
    vodRouteIds: vodRouteIds.length > 0 ? vodRouteIds : null,
    domainBlockIds: domainBlockIds.length > 0 ? domainBlockIds : null,
    storageLocationIds: storageLocationIds.length > 0 ? storageLocationIds : null,
  };
}

export function getAccessScope(req: Request): AccessScope {
  if (!req.accessScope) {
    throw new ForbiddenError('Access scope not loaded');
  }
  return req.accessScope;
}

export function assertApplicationAccess(scope: AccessScope, applicationId: string) {
  if (scope.applicationIds === null) return;
  if (!scope.applicationIds.includes(applicationId)) {
    throw new ForbiddenError('You do not have access to this application');
  }
}

export async function assertInputAccess(
  organizationId: string,
  inputId: string,
  scope: AccessScope,
  repos: Repositories
) {
  if (scope.applicationIds === null) return;
  const input = await repos.inputs.findById(organizationId, inputId);
  if (!input) {
    throw new NotFoundError('Input not found');
  }
  assertApplicationAccess(scope, input.applicationId);
}

export function filterByApplicationIds<T extends { id: string }>(
  items: T[],
  scope: AccessScope
): T[] {
  if (scope.applicationIds === null) return items;
  const allowed = new Set(scope.applicationIds);
  return items.filter((item) => allowed.has(item.id));
}

export function filterInputsByScope<T extends { applicationId: string }>(
  items: T[],
  scope: AccessScope
): T[] {
  if (scope.applicationIds === null) return items;
  const allowed = new Set(scope.applicationIds);
  return items.filter((item) => allowed.has(item.applicationId));
}

export function filterByIdList<T extends { id: string }>(
  items: T[],
  allowedIds: string[] | null
): T[] {
  if (allowedIds === null) return items;
  const allowed = new Set(allowedIds);
  return items.filter((item) => allowed.has(item.id));
}

/** Attach policies on stream keys: unrestricted when null; otherwise limited set. */
export function assertRecordingPolicyAttachAccess(scope: AccessScope, policyId: string) {
  if (scope.recordingPolicyIds === null) return;
  if (!scope.recordingPolicyIds.includes(policyId)) {
    throw new ForbiddenError('You do not have access to this recording policy');
  }
}

/** @deprecated Use assertRecordingPolicyAttachAccess for input assignment checks. */
export const assertRecordingPolicyAccess = assertRecordingPolicyAttachAccess;

export function assertRecordingPolicyDefinitionAccess(scope: AccessScope, policyId: string) {
  if (canManageApplications(scope)) return;
  if (!scope.recordingPolicyIds?.includes(policyId)) {
    throw new ForbiddenError('You do not have access to manage this recording policy');
  }
}

export function canManageRecordingPolicyDefinitions(scope: AccessScope): boolean {
  return canManageApplications(scope) || (scope.recordingPolicyIds?.length ?? 0) > 0;
}

export function canCreateRecordingPolicyDefinitions(scope: AccessScope): boolean {
  return canManageApplications(scope) || (scope.recordingPolicyIds?.length ?? 0) > 0;
}

export function assertVodRouteAccess(scope: AccessScope, vodRouteId: string) {
  if (canManageVodRoutes(scope)) return;
  if (!scope.vodRouteIds?.includes(vodRouteId)) {
    throw new ForbiddenError('You do not have access to this VOD route');
  }
}

export function assertDomainBlockAccess(scope: AccessScope, domainBlockId: string) {
  if (canManageApplications(scope)) return;
  if (!scope.domainBlockIds?.includes(domainBlockId)) {
    throw new ForbiddenError('You do not have access to this privacy policy');
  }
}

export function assertStorageLocationAccess(scope: AccessScope, storageLocationId: string) {
  if (canManageApplications(scope)) return;
  if (!scope.storageLocationIds?.includes(storageLocationId)) {
    throw new ForbiddenError('You do not have access to this storage location');
  }
}

export function filterVodRoutesForScope<T extends { id: string }>(
  items: T[],
  scope: AccessScope
): T[] {
  if (canManageVodRoutes(scope)) return items;
  return filterByIdList(items, scope.vodRouteIds ?? []);
}

export function filterDomainBlocksForScope<T extends { id: string }>(
  items: T[],
  scope: AccessScope
): T[] {
  if (canManageApplications(scope)) return items;
  return filterByIdList(items, scope.domainBlockIds ?? []);
}

export function filterStorageLocationsForScope<T extends { id: string }>(
  items: T[],
  scope: AccessScope
): T[] {
  if (canManageApplications(scope)) return items;
  return filterByIdList(items, scope.storageLocationIds ?? []);
}

/** Policies page / definition CRUD — not the attach-all list used on stream keys. */
export function filterRecordingPoliciesForDefinitions<T extends { id: string }>(
  items: T[],
  scope: AccessScope
): T[] {
  if (canManageApplications(scope)) return items;
  if (scope.recordingPolicyIds === null) return [];
  return filterByIdList(items, scope.recordingPolicyIds);
}

export function canManageApplications(scope: AccessScope): boolean {
  return bypassesApplicationScope(scope.role);
}

export function canManageVodRoutes(scope: AccessScope): boolean {
  return bypassesApplicationScope(scope.role);
}

export function canManageDomainBlockDefinitions(scope: AccessScope): boolean {
  return canManageApplications(scope) || (scope.domainBlockIds?.length ?? 0) > 0;
}

export function canManageStorageLocations(scope: AccessScope): boolean {
  return canManageApplications(scope) || (scope.storageLocationIds?.length ?? 0) > 0;
}

export function filterLiveSessionsByInputScope<T extends { inputId: string }>(
  items: T[],
  scope: AccessScope,
  inputApplicationById: Map<string, string>
): T[] {
  if (scope.applicationIds === null) return items;
  const allowed = new Set(scope.applicationIds);
  return items.filter((session) => {
    const applicationId = inputApplicationById.get(session.inputId);
    return applicationId ? allowed.has(applicationId) : false;
  });
}
