import type { AccessScope } from './access-control';

export type SerializedAccess = {
  allApplications: boolean;
  applicationIds: string[];
  allRecordingPolicies: boolean;
  recordingPolicyIds: string[];
  allVodRoutes: boolean;
  vodRouteIds: string[];
  allDomainBlocks: boolean;
  domainBlockIds: string[];
  allStorageLocations: boolean;
  storageLocationIds: string[];
};

export function serializeAccess(scope: AccessScope): SerializedAccess {
  return {
    allApplications: scope.applicationIds === null,
    applicationIds: scope.applicationIds ?? [],
    allRecordingPolicies: scope.recordingPolicyIds === null,
    recordingPolicyIds: scope.recordingPolicyIds ?? [],
    allVodRoutes: scope.vodRouteIds === null,
    vodRouteIds: scope.vodRouteIds ?? [],
    allDomainBlocks: scope.domainBlockIds === null,
    domainBlockIds: scope.domainBlockIds ?? [],
    allStorageLocations: scope.storageLocationIds === null,
    storageLocationIds: scope.storageLocationIds ?? [],
  };
}
