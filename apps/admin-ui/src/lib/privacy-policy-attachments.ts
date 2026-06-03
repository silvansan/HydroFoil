import type { Output, VodRoute } from '../api/types';
import { api } from '../api/client';

export async function syncPolicyAttachments(
  policyId: string,
  outputs: Output[],
  vodRoutes: VodRoute[],
  selectedOutputIds: string[],
  selectedVodRouteIds: string[]
) {
  const selectedOutputs = new Set(selectedOutputIds);
  const selectedVod = new Set(selectedVodRouteIds);

  const updates: Promise<unknown>[] = [];

  for (const output of outputs) {
    const shouldAttach = selectedOutputs.has(output.id);
    const currentlyAttached = output.domainBlockId === policyId;
    if (shouldAttach && !currentlyAttached) {
      updates.push(api.updateOutput(output.id, { domainBlockId: policyId }));
    } else if (!shouldAttach && currentlyAttached) {
      updates.push(api.updateOutput(output.id, { domainBlockId: undefined }));
    }
  }

  for (const route of vodRoutes) {
    const shouldAttach = selectedVod.has(route.id);
    const currentlyAttached = route.domainBlockId === policyId;
    if (shouldAttach && !currentlyAttached) {
      updates.push(api.updateVodRoute(route.id, { domainBlockId: policyId }));
    } else if (!shouldAttach && currentlyAttached) {
      updates.push(api.updateVodRoute(route.id, { domainBlockId: undefined }));
    }
  }

  await Promise.all(updates);
}
