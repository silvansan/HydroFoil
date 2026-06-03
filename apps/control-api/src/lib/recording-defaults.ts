import type { AppContext } from '../context';

export interface ResolvedRecordingPolicy {
  id: string;
  storage_location_id: string;
  path_prefix: string;
  filename_template: string;
  bucket_name: string;
  storage_prefix: string;
}

/** Resolve recording policy for an input (explicit policy or org default). */
export async function getRecordingPolicyForInput(
  ctx: Pick<AppContext, 'db' | 'organizationId'>,
  input: { recordingPolicyId?: unknown }
): Promise<ResolvedRecordingPolicy | undefined> {
  const policies = await getRecordingPoliciesForInput(ctx, input);
  return policies[0];
}

/** Resolve all recording policies for an input, falling back to the org default when none are assigned. */
export async function getRecordingPoliciesForInput(
  ctx: Pick<AppContext, 'db' | 'organizationId'>,
  input: { id?: unknown; recordingPolicyId?: unknown; recordingPolicyIds?: unknown }
): Promise<ResolvedRecordingPolicy[]> {
  const assignedIds = Array.isArray(input.recordingPolicyIds)
    ? input.recordingPolicyIds.map(String).filter(Boolean)
    : [];
  if (input.recordingPolicyId && !assignedIds.includes(String(input.recordingPolicyId))) {
    assignedIds.unshift(String(input.recordingPolicyId));
  }

  if (assignedIds.length > 0) {
    const result = await ctx.db.query(
      `SELECT rp.*, sl.bucket_name, sl.prefix_path AS storage_prefix
       FROM recording_policies rp
       JOIN storage_locations sl ON sl.id = rp.storage_location_id
       WHERE rp.organization_id = $1 AND rp.id = ANY($2::uuid[]) AND rp.enabled = true
       ORDER BY array_position($2::uuid[], rp.id)`,
      [ctx.organizationId, assignedIds]
    );
    return result.rows as ResolvedRecordingPolicy[];
  }

  if (input.recordingPolicyId) {
    const result = await ctx.db.query(
      `SELECT rp.*, sl.bucket_name, sl.prefix_path AS storage_prefix
       FROM recording_policies rp
       JOIN storage_locations sl ON sl.id = rp.storage_location_id
       WHERE rp.organization_id = $1 AND rp.id = $2 AND rp.enabled = true`,
      [ctx.organizationId, input.recordingPolicyId]
    );
    if (result.rows[0]) {
      return [result.rows[0] as ResolvedRecordingPolicy];
    }
  }
  const defaultPolicy = await getDefaultRecordingPolicy(ctx);
  return defaultPolicy ? [defaultPolicy] : [];
}

/** Resolve default recording policy + storage for the org (seeded in migration 005). */
export async function getDefaultRecordingPolicy(
  ctx: Pick<AppContext, 'db' | 'organizationId'>
): Promise<ResolvedRecordingPolicy | undefined> {
  const result = await ctx.db.query(
    `SELECT rp.*, sl.bucket_name, sl.prefix_path AS storage_prefix
     FROM recording_policies rp
     JOIN storage_locations sl ON sl.id = rp.storage_location_id
     WHERE rp.organization_id = $1 AND rp.enabled = true
     ORDER BY rp.created_at ASC
     LIMIT 1`,
    [ctx.organizationId]
  );
  return result.rows[0] as ResolvedRecordingPolicy | undefined;
}

export function buildRecordingObjectKey(
  app: string,
  streamKey: string,
  sessionId: string,
  policy?: Pick<ResolvedRecordingPolicy, 'path_prefix' | 'filename_template'>
): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  if (policy?.filename_template) {
    const file = policy.filename_template
      .replace(/\{app\}/g, app)
      .replace(/\{streamKey\}/g, streamKey)
      .replace(/\{sessionId\}/g, sessionId)
      .replace(/\{timestamp\}/g, ts);
    const prefix = (policy.path_prefix ?? 'dvr').replace(/^\/+|\/+$/g, '');
    return `${prefix}/${file}`.replace(/\/+/g, '/');
  }
  return `dvr/${app}/${streamKey}/${sessionId}-${ts}.flv`;
}

export function buildStorageLocationRef(organizationId: string, storageLocationId: string): string {
  return `location:${organizationId}:${storageLocationId}`;
}

export function joinStoragePrefix(prefix: string | undefined, objectKey: string): string {
  return [prefix, objectKey]
    .map((part) => String(part ?? '').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}
