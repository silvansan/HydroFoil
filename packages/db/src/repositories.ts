import {
  mapApplication,
  mapAudioFeedProfile,
  mapDvrWatchlistEntry,
  mapDomainBlock,
  mapGeneratedAudioAsset,
  mapInput,
  mapLiveSession,
  mapOrganization,
  mapOutput,
  mapRecordingAsset,
  mapRecordingAssetWithContext,
  mapRecordingPolicy,
  mapRoute,
  mapStorageLocation,
  mapStorageLocationWithSecrets,
  mapStreamProfile,
  mapUser,
  mapVodRoute,
} from './mapper';
import { Database } from './index';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

function paginationClause(page = 1, pageSize = 20) {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(100, Math.max(1, pageSize));
  const offset = (safePage - 1) * safeSize;
  return { safePage, safeSize, offset };
}

export class OrganizationRepository {
  constructor(private readonly db: Database) {}

  async findBySlug(slug: string) {
    const result = await this.db.query('SELECT * FROM organizations WHERE slug = $1', [slug]);
    if (!result.rows[0]) {
      return null;
    }
    return mapOrganization(result.rows[0]);
  }
}

const INPUT_SELECT = `SELECT i.*, a.name AS application_name, a.app_name AS application_app_name,
    COALESCE(
      (SELECT array_agg(irp.recording_policy_id ORDER BY irp.sort_order, irp.created_at)
       FROM input_recording_policies irp
       WHERE irp.input_id = i.id),
      CASE WHEN i.recording_policy_id IS NOT NULL THEN ARRAY[i.recording_policy_id] ELSE ARRAY[]::uuid[] END
    ) AS recording_policy_ids,
    COALESCE(
      (SELECT array_agg(isp.stream_profile_id ORDER BY isp.sort_order, isp.created_at)
       FROM input_stream_profiles isp
       WHERE isp.input_id = i.id),
      CASE WHEN i.stream_profile_id IS NOT NULL THEN ARRAY[i.stream_profile_id] ELSE ARRAY[]::uuid[] END
    ) AS stream_profile_ids,
    COALESCE(
      (SELECT array_agg(iafp.audio_feed_profile_id ORDER BY iafp.sort_order, iafp.created_at)
       FROM input_audio_feed_profiles iafp
       WHERE iafp.input_id = i.id),
      CASE WHEN i.audio_feed_profile_id IS NOT NULL THEN ARRAY[i.audio_feed_profile_id] ELSE ARRAY[]::uuid[] END
    ) AS audio_feed_profile_ids
  FROM inputs i
  INNER JOIN applications a ON a.id = i.application_id`;

export class ApplicationRepository {
  constructor(private readonly db: Database) {}

  async list(
    organizationId: string,
    params: PaginationParams & { applicationIds?: string[] } = {}
  ) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const filters = ['a.organization_id = $1'];
    const values: unknown[] = [organizationId];
    let index = 2;

    if (params.applicationIds?.length) {
      filters.push(`a.id = ANY($${index}::uuid[])`);
      values.push(params.applicationIds);
      index += 1;
    }

    const where = filters.join(' AND ');
    const count = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM applications a WHERE ${where}`,
      values
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT a.*,
        (SELECT COUNT(*)::int FROM inputs WHERE application_id = a.id) AS input_count
       FROM applications a
       WHERE ${where}
       ORDER BY a.name
       LIMIT $${index} OFFSET $${index + 1}`,
      [...values, safeSize, offset]
    );
    return {
      items: result.rows.map(mapApplication),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    } satisfies PaginatedResult<ReturnType<typeof mapApplication>>;
  }

  async listAll(organizationId: string) {
    const result = await this.db.query(
      `SELECT a.*,
        (SELECT COUNT(*)::int FROM inputs WHERE application_id = a.id) AS input_count
       FROM applications a
       WHERE a.organization_id = $1
       ORDER BY a.name`,
      [organizationId]
    );
    return result.rows.map(mapApplication);
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      `SELECT a.*,
        (SELECT COUNT(*)::int FROM inputs WHERE application_id = a.id) AS input_count
       FROM applications a
       WHERE a.organization_id = $1 AND a.id = $2`,
      [organizationId, id]
    );
    return result.rows[0] ? mapApplication(result.rows[0]) : null;
  }

  async findByAppName(organizationId: string, appName: string) {
    const result = await this.db.query(
      'SELECT * FROM applications WHERE organization_id = $1 AND app_name = $2',
      [organizationId, appName]
    );
    return result.rows[0] ? mapApplication(result.rows[0]) : null;
  }

  async create(
    organizationId: string,
    data: { name: string; appName: string; description?: string }
  ) {
    const result = await this.db.query(
      `INSERT INTO applications (organization_id, name, app_name, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [organizationId, data.name, data.appName, data.description ?? null]
    );
    return mapApplication(result.rows[0]);
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{ name: string; appName: string; description: string | null }>
  ) {
    const fields: string[] = [];
    const values: unknown[] = [organizationId, id];
    let index = 3;

    const setField = (column: string, value: unknown) => {
      fields.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    };

    if (data.name !== undefined) setField('name', data.name);
    if (data.appName !== undefined) setField('app_name', data.appName);
    if (data.description !== undefined) setField('description', data.description);

    if (fields.length === 0) {
      return this.findById(organizationId, id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    const result = await this.db.query(
      `UPDATE applications SET ${fields.join(', ')}
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      values
    );
    return result.rows[0] ? mapApplication(result.rows[0]) : null;
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM applications WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export class InputRepository {
  constructor(private readonly db: Database) {}

  private async syncAssignments(
    table: 'input_recording_policies' | 'input_stream_profiles' | 'input_audio_feed_profiles',
    column: 'recording_policy_id' | 'stream_profile_id' | 'audio_feed_profile_id',
    inputId: string,
    ids: string[] | undefined
  ) {
    if (ids === undefined) return;
    await this.db.query(`DELETE FROM ${table} WHERE input_id = $1`, [inputId]);
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    for (const [index, id] of uniqueIds.entries()) {
      await this.db.query(
        `INSERT INTO ${table} (input_id, ${column}, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (input_id, ${column}) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
        [inputId, id, index]
      );
    }
  }

  async list(
    organizationId: string,
    params: PaginationParams & { applicationId?: string; applicationIds?: string[] } = {}
  ) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const filters = ['i.organization_id = $1'];
    const values: unknown[] = [organizationId];
    let index = 2;

    if (params.applicationId) {
      filters.push(`i.application_id = $${index}`);
      values.push(params.applicationId);
      index += 1;
    } else if (params.applicationIds?.length) {
      filters.push(`i.application_id = ANY($${index}::uuid[])`);
      values.push(params.applicationIds);
      index += 1;
    }

    const where = filters.join(' AND ');
    const count = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM inputs i WHERE ${where}`,
      values
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `${INPUT_SELECT}
       WHERE ${where}
       ORDER BY i.created_at DESC LIMIT $${index} OFFSET $${index + 1}`,
      [...values, safeSize, offset]
    );
    return {
      items: result.rows.map(mapInput),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    } satisfies PaginatedResult<ReturnType<typeof mapInput>>;
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      `${INPUT_SELECT} WHERE i.organization_id = $1 AND i.id = $2`,
      [organizationId, id]
    );
    return result.rows[0] ? mapInput(result.rows[0]) : null;
  }

  async create(
    organizationId: string,
    data: {
      applicationId: string;
      name: string;
      streamKey: string;
      ingestProtocol: string;
      enabled?: boolean;
      sourceRestrictions?: string[];
      streamProfileId?: string;
      recordingPolicyId?: string;
      audioFeedProfileId?: string;
      streamProfileIds?: string[];
      recordingPolicyIds?: string[];
      audioFeedProfileIds?: string[];
    }
  ) {
    const streamProfileIds = data.streamProfileIds ?? (data.streamProfileId ? [data.streamProfileId] : []);
    const recordingPolicyIds = data.recordingPolicyIds ?? (data.recordingPolicyId ? [data.recordingPolicyId] : []);
    const audioFeedProfileIds = data.audioFeedProfileIds ?? (data.audioFeedProfileId ? [data.audioFeedProfileId] : []);
    const result = await this.db.query(
      `INSERT INTO inputs (
        organization_id, application_id, name, stream_key, ingest_protocol, enabled,
        source_restrictions, stream_profile_id, recording_policy_id, audio_feed_profile_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        organizationId,
        data.applicationId,
        data.name,
        data.streamKey,
        data.ingestProtocol,
        data.enabled ?? true,
        data.sourceRestrictions ?? null,
        streamProfileIds[0] ?? null,
        recordingPolicyIds[0] ?? null,
        audioFeedProfileIds[0] ?? null,
      ]
    );
    const created = result.rows[0];
    await this.syncAssignments('input_stream_profiles', 'stream_profile_id', String(created.id), streamProfileIds);
    await this.syncAssignments('input_recording_policies', 'recording_policy_id', String(created.id), recordingPolicyIds);
    await this.syncAssignments('input_audio_feed_profiles', 'audio_feed_profile_id', String(created.id), audioFeedProfileIds);
    return this.findById(organizationId, String(created.id));
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      streamKey: string;
      ingestProtocol: string;
      enabled: boolean;
      sourceRestrictions: string[] | null;
      streamProfileId: string | null;
      recordingPolicyId: string | null;
      audioFeedProfileId: string | null;
      streamProfileIds: string[];
      recordingPolicyIds: string[];
      audioFeedProfileIds: string[];
    }>
  ) {
    const fields: string[] = [];
    const values: unknown[] = [organizationId, id];
    let index = 3;

    const setField = (column: string, value: unknown) => {
      fields.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    };

    if (data.name !== undefined) setField('name', data.name);
    if (data.streamKey !== undefined) setField('stream_key', data.streamKey);
    if (data.ingestProtocol !== undefined) setField('ingest_protocol', data.ingestProtocol);
    if (data.enabled !== undefined) setField('enabled', data.enabled);
    if (data.sourceRestrictions !== undefined) {
      setField('source_restrictions', data.sourceRestrictions);
    }
    if (data.streamProfileId !== undefined) setField('stream_profile_id', data.streamProfileId);
    if (data.recordingPolicyId !== undefined) setField('recording_policy_id', data.recordingPolicyId);
    if (data.audioFeedProfileId !== undefined) {
      setField('audio_feed_profile_id', data.audioFeedProfileId);
    }
    if (data.streamProfileIds !== undefined) {
      setField('stream_profile_id', data.streamProfileIds[0] ?? null);
    }
    if (data.recordingPolicyIds !== undefined) {
      setField('recording_policy_id', data.recordingPolicyIds[0] ?? null);
    }
    if (data.audioFeedProfileIds !== undefined) {
      setField('audio_feed_profile_id', data.audioFeedProfileIds[0] ?? null);
    }

    const hasAssignmentChanges =
      data.streamProfileIds !== undefined ||
      data.recordingPolicyIds !== undefined ||
      data.audioFeedProfileIds !== undefined;

    if (fields.length === 0 && !hasAssignmentChanges) {
      return this.findById(organizationId, id);
    }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      const result = await this.db.query(
        `UPDATE inputs SET ${fields.join(', ')}
         WHERE organization_id = $1 AND id = $2
         RETURNING id`,
        values
      );
      if (!result.rows[0]) return null;
    } else {
      const existing = await this.findById(organizationId, id);
      if (!existing) return null;
    }
    await this.syncAssignments('input_stream_profiles', 'stream_profile_id', id, data.streamProfileIds);
    await this.syncAssignments('input_recording_policies', 'recording_policy_id', id, data.recordingPolicyIds);
    await this.syncAssignments('input_audio_feed_profiles', 'audio_feed_profile_id', id, data.audioFeedProfileIds);
    return this.findById(organizationId, id);
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM inputs WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** @deprecated Prefer findByAppAndStreamKey when SRS app is known */
  async findByStreamKey(organizationId: string, streamKey: string) {
    const result = await this.db.query(
      `${INPUT_SELECT}
       WHERE i.organization_id = $1 AND i.stream_key = $2
       LIMIT 1`,
      [organizationId, streamKey]
    );
    return result.rows[0] ? mapInput(result.rows[0]) : null;
  }

  async findByAppAndStreamKey(organizationId: string, appName: string, streamKey: string) {
    const result = await this.db.query(
      `${INPUT_SELECT}
       WHERE i.organization_id = $1 AND a.app_name = $2 AND i.stream_key = $3`,
      [organizationId, appName, streamKey]
    );
    return result.rows[0] ? mapInput(result.rows[0]) : null;
  }

  async listAll(organizationId: string, applicationId?: string) {
    if (applicationId) {
      const result = await this.db.query(
        `${INPUT_SELECT}
         WHERE i.organization_id = $1 AND i.application_id = $2
         ORDER BY i.name`,
        [organizationId, applicationId]
      );
      return result.rows.map(mapInput);
    }
    const result = await this.db.query(
      `${INPUT_SELECT}
       WHERE i.organization_id = $1
       ORDER BY a.name, i.name`,
      [organizationId]
    );
    return result.rows.map(mapInput);
  }
}

export class OutputRepository {
  constructor(private readonly db: Database) {}

  async list(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM outputs WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT * FROM outputs WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
    );
    return {
      items: result.rows.map(mapOutput),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    };
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM outputs WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapOutput(result.rows[0]) : null;
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      routeTarget: string;
      playbackProtocol: string;
      gatewayAppName: string;
      gatewayStreamName: string;
      domainBlockId?: string;
      streamProfileId?: string;
      enabled?: boolean;
      isPublic?: boolean;
    }
  ) {
    const result = await this.db.query(
      `INSERT INTO outputs (
        organization_id, name, route_target, playback_protocol,
        gateway_app_name, gateway_stream_name, domain_block_id,
        stream_profile_id, enabled, is_public
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        organizationId,
        data.name,
        data.routeTarget,
        data.playbackProtocol,
        data.gatewayAppName,
        data.gatewayStreamName,
        data.domainBlockId ?? null,
        data.streamProfileId ?? null,
        data.enabled ?? true,
        data.isPublic ?? false,
      ]
    );
    return mapOutput(result.rows[0]);
  }

  async update(
    organizationId: string,
    id: string,
    patch: Record<string, unknown>
  ) {
    const columnMap: Record<string, string> = {
      name: 'name',
      routeTarget: 'route_target',
      playbackProtocol: 'playback_protocol',
      gatewayAppName: 'gateway_app_name',
      gatewayStreamName: 'gateway_stream_name',
      domainBlockId: 'domain_block_id',
      streamProfileId: 'stream_profile_id',
      enabled: 'enabled',
      isPublic: 'is_public',
    };

    const fields: string[] = [];
    const values: unknown[] = [organizationId, id];
    let index = 3;

    for (const [key, column] of Object.entries(columnMap)) {
      if (patch[key] !== undefined) {
        fields.push(`${column} = $${index}`);
        values.push(patch[key]);
        index += 1;
      }
    }

    if (fields.length === 0) {
      return this.findById(organizationId, id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const result = await this.db.query(
      `UPDATE outputs SET ${fields.join(', ')}
       WHERE organization_id = $1 AND id = $2 RETURNING *`,
      values
    );
    return result.rows[0] ? mapOutput(result.rows[0]) : null;
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM outputs WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listAll(organizationId: string) {
    const result = await this.db.query(
      'SELECT * FROM outputs WHERE organization_id = $1 ORDER BY name',
      [organizationId]
    );
    return result.rows.map(mapOutput);
  }
}

export class RouteRepository {
  constructor(private readonly db: Database) {}

  async list(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM routes WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT * FROM routes WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
    );
    return {
      items: result.rows.map(mapRoute),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    };
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM routes WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapRoute(result.rows[0]) : null;
  }

  async findByInputId(organizationId: string, inputId: string) {
    const result = await this.db.query(
      `SELECT * FROM routes WHERE organization_id = $1 AND input_id = $2 ORDER BY created_at`,
      [organizationId, inputId]
    );
    return result.rows.map(mapRoute);
  }

  async create(
    organizationId: string,
    data: {
      inputId: string;
      name: string;
      outputIds: string[];
      streamProfileId?: string;
      enabled?: boolean;
    }
  ) {
    const result = await this.db.query(
      `INSERT INTO routes (organization_id, input_id, name, enabled, output_ids, stream_profile_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        organizationId,
        data.inputId,
        data.name,
        data.enabled ?? true,
        data.outputIds,
        data.streamProfileId ?? null,
      ]
    );
    return mapRoute(result.rows[0]);
  }

  async update(organizationId: string, id: string, patch: Record<string, unknown>) {
    const columnMap: Record<string, string> = {
      inputId: 'input_id',
      name: 'name',
      enabled: 'enabled',
      outputIds: 'output_ids',
      streamProfileId: 'stream_profile_id',
    };
    const fields: string[] = [];
    const values: unknown[] = [organizationId, id];
    let index = 3;

    for (const [key, column] of Object.entries(columnMap)) {
      if (patch[key] !== undefined) {
        fields.push(`${column} = $${index}`);
        values.push(patch[key]);
        index += 1;
      }
    }

    if (fields.length === 0) {
      return this.findById(organizationId, id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const result = await this.db.query(
      `UPDATE routes SET ${fields.join(', ')}
       WHERE organization_id = $1 AND id = $2 RETURNING *`,
      values
    );
    return result.rows[0] ? mapRoute(result.rows[0]) : null;
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM routes WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listAll(organizationId: string) {
    const result = await this.db.query(
      'SELECT * FROM routes WHERE organization_id = $1 ORDER BY name',
      [organizationId]
    );
    return result.rows.map(mapRoute);
  }
}

export class DomainBlockRepository {
  constructor(private readonly db: Database) {}

  async list(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM domain_blocks WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT * FROM domain_blocks WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
    );
    return {
      items: result.rows.map(mapDomainBlock),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    };
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM domain_blocks WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapDomainBlock(result.rows[0]) : null;
  }

  async findBySlug(organizationId: string, slug: string) {
    const result = await this.db.query(
      'SELECT * FROM domain_blocks WHERE organization_id = $1 AND slug = $2',
      [organizationId, slug]
    );
    return result.rows[0] ? mapDomainBlock(result.rows[0]) : null;
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      slug: string;
      allowedDomains: string[];
      branding?: Record<string, unknown>;
      playbackAccessPolicy: string;
      tokenRequired?: boolean;
    }
  ) {
    const result = await this.db.query(
      `INSERT INTO domain_blocks (
        organization_id, name, slug, allowed_domains, branding,
        playback_access_policy, token_required
      ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        organizationId,
        data.name,
        data.slug,
        data.allowedDomains,
        data.branding ? JSON.stringify(data.branding) : null,
        data.playbackAccessPolicy,
        data.tokenRequired ?? false,
      ]
    );
    return mapDomainBlock(result.rows[0]);
  }

  async listAll(organizationId: string) {
    const result = await this.db.query(
      'SELECT * FROM domain_blocks WHERE organization_id = $1 ORDER BY name',
      [organizationId]
    );
    return result.rows.map(mapDomainBlock);
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      allowedDomains: string[];
      branding: Record<string, unknown> | null;
      playbackAccessPolicy: string;
      tokenRequired: boolean;
    }>
  ) {
    const fields: string[] = [];
    const values: unknown[] = [organizationId, id];
    let index = 3;

    const setField = (column: string, value: unknown) => {
      fields.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    };

    if (data.name !== undefined) setField('name', data.name);
    if (data.slug !== undefined) setField('slug', data.slug);
    if (data.allowedDomains !== undefined) setField('allowed_domains', data.allowedDomains);
    if (data.branding !== undefined) {
      setField('branding', data.branding ? JSON.stringify(data.branding) : null);
    }
    if (data.playbackAccessPolicy !== undefined) {
      setField('playback_access_policy', data.playbackAccessPolicy);
    }
    if (data.tokenRequired !== undefined) setField('token_required', data.tokenRequired);

    if (fields.length === 0) {
      return this.findById(organizationId, id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const result = await this.db.query(
      `UPDATE domain_blocks SET ${fields.join(', ')}
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      values
    );
    return result.rows[0] ? mapDomainBlock(result.rows[0]) : null;
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM domain_blocks WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export class UserRepository {
  constructor(private readonly db: Database) {}

  async list(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM users WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT * FROM users WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
    );
    return {
      items: result.rows.map(mapUser),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    } satisfies PaginatedResult<ReturnType<typeof mapUser>>;
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM users WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findByEmail(organizationId: string, email: string) {
    const result = await this.db.query(
      'SELECT * FROM users WHERE organization_id = $1 AND LOWER(email) = LOWER($2)',
      [organizationId, email]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findByEmailWithPasswordHash(organizationId: string, email: string) {
    const result = await this.db.query(
      'SELECT * FROM users WHERE organization_id = $1 AND LOWER(email) = LOWER($2)',
      [organizationId, email]
    );
    return (result.rows[0] as
      | {
          id: string;
          organization_id: string;
          email: string;
          display_name: string | null;
          password_hash: string | null;
          role: 'super-admin' | 'admin' | 'manager';
          is_active: boolean;
        }
      | undefined) ?? null;
  }

  async create(
    organizationId: string,
    data: {
      email: string;
      displayName?: string;
      passwordHash?: string;
      role?: 'super-admin' | 'admin' | 'manager';
      isActive?: boolean;
    }
  ) {
    const result = await this.db.query(
      `INSERT INTO users (
        organization_id, email, display_name, password_hash, role, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *`,
      [
        organizationId,
        data.email,
        data.displayName ?? null,
        data.passwordHash ?? null,
        data.role ?? 'manager',
        data.isActive ?? true,
      ]
    );
    return mapUser(result.rows[0]);
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      email: string;
      displayName: string | null;
      passwordHash: string | null;
      role: 'super-admin' | 'admin' | 'manager';
      isActive: boolean;
    }>
  ) {
    const fields: string[] = [];
    const values: unknown[] = [organizationId, id];
    let index = 3;

    const setField = (column: string, value: unknown) => {
      fields.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    };

    if (data.email !== undefined) setField('email', data.email);
    if (data.displayName !== undefined) setField('display_name', data.displayName);
    if (data.passwordHash !== undefined) setField('password_hash', data.passwordHash);
    if (data.role !== undefined) setField('role', data.role);
    if (data.isActive !== undefined) setField('is_active', data.isActive);

    if (fields.length === 0) {
      return this.findById(organizationId, id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const result = await this.db.query(
      `UPDATE users SET ${fields.join(', ')}
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      values
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM users WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export class VodRouteRepository {
  constructor(private readonly db: Database) {}

  async list(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM vod_routes WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT * FROM vod_routes WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
    );
    return {
      items: result.rows.map(mapVodRoute),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    } satisfies PaginatedResult<ReturnType<typeof mapVodRoute>>;
  }

  async listAll(organizationId: string) {
    const result = await this.db.query(
      'SELECT * FROM vod_routes WHERE organization_id = $1 ORDER BY name',
      [organizationId]
    );
    return result.rows.map(mapVodRoute);
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM vod_routes WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapVodRoute(result.rows[0]) : null;
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      enabled?: boolean;
      requestDomain?: string;
      publicPath: string;
      deliveryType: 'hls' | 'progressive';
      sourceType: 'storage-location' | 'remote-http';
      storageLocationId?: string;
      sourcePath: string;
      domainBlockId?: string;
      allowDirectAccess?: boolean;
      generateIframePlaylist?: boolean;
    }
  ) {
    const result = await this.db.query(
      `INSERT INTO vod_routes (
        organization_id, name, enabled, request_domain, public_path,
        delivery_type, source_type, storage_location_id, source_path,
        domain_block_id, allow_direct_access, generate_iframe_playlist
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *`,
      [
        organizationId,
        data.name,
        data.enabled ?? true,
        data.requestDomain ?? null,
        data.publicPath,
        data.deliveryType,
        data.sourceType,
        data.storageLocationId ?? null,
        data.sourcePath,
        data.domainBlockId ?? null,
        data.allowDirectAccess ?? false,
        data.generateIframePlaylist ?? false,
      ]
    );
    return mapVodRoute(result.rows[0]);
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      enabled: boolean;
      requestDomain: string | null;
      publicPath: string;
      deliveryType: 'hls' | 'progressive';
      sourceType: 'storage-location' | 'remote-http';
      storageLocationId: string | null;
      sourcePath: string;
      domainBlockId: string | null;
      allowDirectAccess: boolean;
      generateIframePlaylist: boolean;
    }>
  ) {
    const fields: string[] = [];
    const values: unknown[] = [organizationId, id];
    let index = 3;

    const setField = (column: string, value: unknown) => {
      fields.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    };

    if (data.name !== undefined) setField('name', data.name);
    if (data.enabled !== undefined) setField('enabled', data.enabled);
    if (data.requestDomain !== undefined) setField('request_domain', data.requestDomain);
    if (data.publicPath !== undefined) setField('public_path', data.publicPath);
    if (data.deliveryType !== undefined) setField('delivery_type', data.deliveryType);
    if (data.sourceType !== undefined) setField('source_type', data.sourceType);
    if (data.storageLocationId !== undefined) {
      setField('storage_location_id', data.storageLocationId);
    }
    if (data.sourcePath !== undefined) setField('source_path', data.sourcePath);
    if (data.domainBlockId !== undefined) setField('domain_block_id', data.domainBlockId);
    if (data.allowDirectAccess !== undefined) {
      setField('allow_direct_access', data.allowDirectAccess);
    }
    if (data.generateIframePlaylist !== undefined) {
      setField('generate_iframe_playlist', data.generateIframePlaylist);
    }

    if (fields.length === 0) {
      return this.findById(organizationId, id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const result = await this.db.query(
      `UPDATE vod_routes SET ${fields.join(', ')}
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      values
    );
    return result.rows[0] ? mapVodRoute(result.rows[0]) : null;
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM vod_routes WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export class DvrWatchlistRepository {
  constructor(private readonly db: Database) {}

  async list(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM dvr_watchlist_entries WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT * FROM dvr_watchlist_entries WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
    );
    return {
      items: result.rows.map(mapDvrWatchlistEntry),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    } satisfies PaginatedResult<ReturnType<typeof mapDvrWatchlistEntry>>;
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM dvr_watchlist_entries WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapDvrWatchlistEntry(result.rows[0]) : null;
  }

  async create(
    organizationId: string,
    data: {
      applicationName: string;
      streamPattern?: string;
      retentionHours?: number;
      storageLocationId: string;
      enabled?: boolean;
    }
  ) {
    const application = await this.db.query(
      'SELECT id, app_name FROM applications WHERE organization_id = $1 AND app_name = $2',
      [organizationId, data.applicationName]
    );
    const applicationRow = application.rows[0] as
      | { id: string; app_name: string }
      | undefined;
    const result = await this.db.query(
      `INSERT INTO dvr_watchlist_entries (
        organization_id, application_id, application_name, stream_pattern,
        retention_hours, storage_location_id, enabled
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        organizationId,
        applicationRow?.id ?? null,
        data.applicationName,
        data.streamPattern ?? '*',
        data.retentionHours ?? 24,
        data.storageLocationId,
        data.enabled ?? true,
      ]
    );
    return mapDvrWatchlistEntry(result.rows[0]);
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      streamPattern: string;
      retentionHours: number;
      storageLocationId: string;
      enabled: boolean;
    }>
  ) {
    const fields: string[] = [];
    const values: unknown[] = [organizationId, id];
    let index = 3;

    const setField = (column: string, value: unknown) => {
      fields.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    };

    if (data.streamPattern !== undefined) setField('stream_pattern', data.streamPattern);
    if (data.retentionHours !== undefined) setField('retention_hours', data.retentionHours);
    if (data.storageLocationId !== undefined) {
      setField('storage_location_id', data.storageLocationId);
    }
    if (data.enabled !== undefined) setField('enabled', data.enabled);

    if (fields.length === 0) {
      return this.findById(organizationId, id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const result = await this.db.query(
      `UPDATE dvr_watchlist_entries SET ${fields.join(', ')}
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      values
    );
    return result.rows[0] ? mapDvrWatchlistEntry(result.rows[0]) : null;
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM dvr_watchlist_entries WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export class StorageLocationRepository {
  constructor(private readonly db: Database) {}

  async list(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM storage_locations WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT * FROM storage_locations WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
    );
    return {
      items: result.rows.map(mapStorageLocation),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    };
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM storage_locations WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapStorageLocation(result.rows[0]) : null;
  }

  async findByIdWithSecrets(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM storage_locations WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapStorageLocationWithSecrets(result.rows[0]) : null;
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      type: string;
      bucketName: string;
      prefixPath?: string;
      isDefault?: boolean;
      endpoint?: string;
      region?: string;
      useSsl?: boolean;
      publicEndpoint?: string;
      pathStyle?: boolean;
      accessKey?: string;
      secretKey?: string;
    }
  ) {
    const result = await this.db.query(
      `INSERT INTO storage_locations (
        organization_id, name, type, bucket_name, prefix_path, is_default,
        endpoint, region, use_ssl, public_endpoint, path_style, access_key, secret_key
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        organizationId,
        data.name,
        data.type,
        data.bucketName,
        data.prefixPath ?? '',
        data.isDefault ?? false,
        data.endpoint ?? null,
        data.region ?? null,
        data.useSsl ?? false,
        data.publicEndpoint ?? null,
        data.pathStyle ?? true,
        data.accessKey ?? null,
        data.secretKey ?? null,
      ]
    );
    return mapStorageLocation(result.rows[0]);
  }
}

export class LiveSessionRepository {
  constructor(private readonly db: Database) {}

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM live_sessions WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapLiveSession(result.rows[0]) : null;
  }

  async findActiveByStreamKey(organizationId: string, streamKey: string) {
    const result = await this.db.query(
      `SELECT * FROM live_sessions
       WHERE organization_id = $1 AND stream_key = $2 AND status = 'publishing'
       ORDER BY started_at DESC
       LIMIT 1`,
      [organizationId, streamKey]
    );
    return result.rows[0] ? mapLiveSession(result.rows[0]) : null;
  }

  async findActiveByAppAndStreamKey(
    organizationId: string,
    gatewayApp: string,
    streamKey: string
  ) {
    const result = await this.db.query(
      `SELECT * FROM live_sessions
       WHERE organization_id = $1 AND gateway_app = $2 AND stream_key = $3 AND status = 'publishing'
       ORDER BY started_at DESC
       LIMIT 1`,
      [organizationId, gatewayApp, streamKey]
    );
    return result.rows[0] ? mapLiveSession(result.rows[0]) : null;
  }

  async create(params: {
    inputId: string;
    organizationId: string;
    gatewayApp: string;
    streamKey: string;
    status?: string;
  }) {
    const result = await this.db.query(
      `INSERT INTO live_sessions (input_id, organization_id, gateway_app, stream_key, status, started_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        params.inputId,
        params.organizationId,
        params.gatewayApp,
        params.streamKey,
        params.status ?? 'publishing',
      ]
    );
    return mapLiveSession(result.rows[0]);
  }

  async endSession(sessionId: string, status: string = 'idle') {
    const result = await this.db.query(
      `UPDATE live_sessions
       SET status = $2, ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [sessionId, status]
    );
    return result.rows[0] ? mapLiveSession(result.rows[0]) : null;
  }

  async updateStatus(sessionId: string, status: string) {
    const result = await this.db.query(
      `UPDATE live_sessions SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [sessionId, status]
    );
    return result.rows[0] ? mapLiveSession(result.rows[0]) : null;
  }

  async listPublishing(organizationId: string) {
    const result = await this.db.query(
      `SELECT * FROM live_sessions
       WHERE organization_id = $1 AND status = 'publishing'
       ORDER BY started_at DESC`,
      [organizationId]
    );
    return result.rows.map(mapLiveSession);
  }

  async list(
    organizationId: string,
    params: PaginationParams = {},
    options: { status?: string; inputId?: string } = {}
  ) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const conditions = ['organization_id = $1'];
    const values: unknown[] = [organizationId];
    let paramIndex = 2;

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(options.status);
    }
    if (options.inputId) {
      conditions.push(`input_id = $${paramIndex++}`);
      values.push(options.inputId);
    }

    const where = conditions.join(' AND ');
    const count = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM live_sessions WHERE ${where}`,
      values
    );
    const total = count.rows[0].total as number;
    values.push(safeSize, offset);
    const result = await this.db.query(
      `SELECT * FROM live_sessions WHERE ${where}
       ORDER BY started_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );
    return {
      items: result.rows.map(mapLiveSession),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    };
  }

  async listByInputId(organizationId: string, inputId: string, params: PaginationParams = {}) {
    return this.list(organizationId, params, { inputId });
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM live_sessions WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

const RECORDING_ASSET_CONTEXT_FROM = `
  FROM recording_assets ra
  INNER JOIN live_sessions ls
    ON ls.id = ra.live_session_id AND ls.organization_id = ra.organization_id
  INNER JOIN inputs i ON i.id = ls.input_id AND i.organization_id = ra.organization_id
  LEFT JOIN applications app ON app.id = i.application_id AND app.organization_id = ra.organization_id
  LEFT JOIN recording_policies rp
    ON rp.id = ra.recording_policy_id AND rp.organization_id = ra.organization_id
`;

export class RecordingAssetRepository {
  constructor(private readonly db: Database) {}

  async list(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM recording_assets WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT * FROM recording_assets WHERE organization_id = $1
       ORDER BY started_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
    );
    return {
      items: result.rows.map(mapRecordingAsset),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    };
  }

  async listWithContext(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM recording_assets WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT ra.*,
        i.id AS input_id,
        i.name AS input_name,
        i.stream_key,
        app.id AS application_id,
        app.name AS application_name,
        rp.name AS recording_policy_name
      ${RECORDING_ASSET_CONTEXT_FROM}
      WHERE ra.organization_id = $1
      ORDER BY ra.started_at DESC
      LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
    );
    return {
      items: result.rows.map(mapRecordingAssetWithContext),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    };
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM recording_assets WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapRecordingAsset(result.rows[0]) : null;
  }

  async findByIdWithContext(organizationId: string, id: string) {
    const result = await this.db.query(
      `SELECT ra.*,
        i.id AS input_id,
        i.name AS input_name,
        i.stream_key,
        app.id AS application_id,
        app.name AS application_name,
        rp.name AS recording_policy_name
      ${RECORDING_ASSET_CONTEXT_FROM}
      WHERE ra.organization_id = $1 AND ra.id = $2`,
      [organizationId, id]
    );
    return result.rows[0] ? mapRecordingAssetWithContext(result.rows[0]) : null;
  }

  async findActiveBySessionId(organizationId: string, liveSessionId: string) {
    const result = await this.db.query(
      `SELECT * FROM recording_assets
       WHERE organization_id = $1 AND live_session_id = $2 AND status = 'recording'
       ORDER BY started_at DESC LIMIT 1`,
      [organizationId, liveSessionId]
    );
    return result.rows[0] ? mapRecordingAsset(result.rows[0]) : null;
  }

  async listActiveBySessionId(organizationId: string, liveSessionId: string) {
    const result = await this.db.query(
      `SELECT * FROM recording_assets
       WHERE organization_id = $1 AND live_session_id = $2 AND status = 'recording'
       ORDER BY started_at DESC`,
      [organizationId, liveSessionId]
    );
    return result.rows.map(mapRecordingAsset);
  }

  async create(params: {
    organizationId: string;
    liveSessionId: string;
    recordingPolicyId: string;
    storageLocation: string;
    objectKey: string;
  }) {
    const result = await this.db.query(
      `INSERT INTO recording_assets (
        organization_id, live_session_id, recording_policy_id, status,
        storage_location, object_key, duration, file_size, started_at
      ) VALUES ($1, $2, $3, 'recording', $4, $5, 0, 0, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        params.organizationId,
        params.liveSessionId,
        params.recordingPolicyId,
        params.storageLocation,
        params.objectKey,
      ]
    );
    return mapRecordingAsset(result.rows[0]);
  }

  /** Mark recording as finalizing and enqueue upload (duration known at stop/unpublish). */
  async beginFinalize(organizationId: string, id: string, params: { duration: number }) {
    const result = await this.db.query(
      `UPDATE recording_assets
       SET status = 'finalizing', duration = $3,
           finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      [organizationId, id, params.duration]
    );
    return result.rows[0] ? mapRecordingAsset(result.rows[0]) : null;
  }

  /** Worker completes MinIO upload and registers file size. */
  async completeFinalize(
    organizationId: string,
    id: string,
    params: {
      fileSize: number;
      status?: string;
      objectKey?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    const result = await this.db.query(
      `UPDATE recording_assets
       SET status = $3, file_size = $4,
           object_key = COALESCE($5, object_key),
           metadata = COALESCE($6, metadata),
           updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      [
        organizationId,
        id,
        params.status ?? 'ready',
        params.fileSize,
        params.objectKey ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
    );
    return result.rows[0] ? mapRecordingAsset(result.rows[0]) : null;
  }

  async markFailed(organizationId: string, id: string) {
    const result = await this.db.query(
      `UPDATE recording_assets
       SET status = 'failed', updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      [organizationId, id]
    );
    return result.rows[0] ? mapRecordingAsset(result.rows[0]) : null;
  }

  async listExpiredSourceFlvCopies(limit = 100) {
    const result = await this.db.query(
      `SELECT *
       FROM recording_assets
       WHERE metadata ? 'sourceFlvRetainUntil'
         AND metadata ? 'sourceFlvObjectKey'
         AND (metadata->>'sourceFlvRetainUntil')::timestamptz <= CURRENT_TIMESTAMP
       ORDER BY (metadata->>'sourceFlvRetainUntil')::timestamptz ASC
       LIMIT $1`,
      [Math.max(1, Math.min(500, limit))]
    );
    return result.rows.map(mapRecordingAsset);
  }

  async markSourceFlvCleaned(organizationId: string, id: string) {
    const result = await this.db.query(
      `UPDATE recording_assets
       SET metadata = (COALESCE(metadata, '{}'::jsonb) - 'sourceFlvRetainUntil')
         || jsonb_build_object('sourceFlvCleanedAt', to_jsonb(CURRENT_TIMESTAMP)),
         updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      [organizationId, id]
    );
    return result.rows[0] ? mapRecordingAsset(result.rows[0]) : null;
  }

  /** @deprecated Use beginFinalize + completeFinalize via media-worker. */
  async finalize(
    organizationId: string,
    id: string,
    params: { duration: number; fileSize?: number; status?: string }
  ) {
    const result = await this.db.query(
      `UPDATE recording_assets
       SET status = $3, duration = $4, file_size = $5,
           finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      [
        organizationId,
        id,
        params.status ?? 'ready',
        params.duration,
        params.fileSize ?? 0,
      ]
    );
    return result.rows[0] ? mapRecordingAsset(result.rows[0]) : null;
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM recording_assets WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export class GeneratedAudioAssetRepository {
  constructor(private readonly db: Database) {}

  private buildDedupeKey(params: {
    liveSessionId: string;
    audioFeedProfileId: string;
    codec: string;
  }) {
    return `${params.liveSessionId}:${params.audioFeedProfileId}:${params.codec}`;
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM generated_audio_assets WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapGeneratedAudioAsset(result.rows[0]) : null;
  }

  async listReadyByRecordingAssetId(organizationId: string, recordingAssetId: string) {
    const result = await this.db.query(
      `SELECT * FROM generated_audio_assets
       WHERE organization_id = $1
         AND recording_asset_id = $2
         AND status = 'ready'
       ORDER BY codec, created_at ASC`,
      [organizationId, recordingAssetId]
    );
    return result.rows.map(mapGeneratedAudioAsset);
  }

  async create(params: {
    organizationId: string;
    audioFeedProfileId: string;
    codec: string;
    storageLocation: string;
    objectKey: string;
    liveSessionId: string;
    recordingAssetId?: string;
    duration?: number;
  }) {
    return (await this.createOrGet(params)).asset;
  }

  async createOrGet(params: {
    organizationId: string;
    audioFeedProfileId: string;
    codec: string;
    storageLocation: string;
    objectKey: string;
    liveSessionId: string;
    recordingAssetId?: string;
    duration?: number;
  }) {
    const dedupeKey = this.buildDedupeKey(params);
    const result = await this.db.query(
      `INSERT INTO generated_audio_assets (
        organization_id, recording_asset_id, live_session_id, audio_feed_profile_id,
        dedupe_key, codec, status, storage_location, object_key, file_size, duration
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, 0, $9)
      ON CONFLICT (organization_id, dedupe_key) DO UPDATE
      SET updated_at = CURRENT_TIMESTAMP
      RETURNING *, (xmax = 0) AS inserted`,
      [
        params.organizationId,
        params.recordingAssetId ?? null,
        params.liveSessionId,
        params.audioFeedProfileId,
        dedupeKey,
        params.codec,
        params.storageLocation,
        params.objectKey,
        params.duration ?? 0,
      ]
    );
    return {
      asset: mapGeneratedAudioAsset(result.rows[0]),
      created: Boolean(result.rows[0]?.inserted),
    };
  }

  async beginProcessing(organizationId: string, id: string) {
    const result = await this.db.query(
      `UPDATE generated_audio_assets
       SET status = 'processing', updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = $1 AND id = $2 AND status IN ('pending', 'failed')
       RETURNING *`,
      [organizationId, id]
    );
    return result.rows[0] ? mapGeneratedAudioAsset(result.rows[0]) : null;
  }

  async complete(
    organizationId: string,
    id: string,
    params: { fileSize: number; duration: number; objectKey?: string }
  ) {
    const result = await this.db.query(
      `UPDATE generated_audio_assets
       SET status = 'ready', file_size = $3, duration = $4,
           object_key = COALESCE($5, object_key), updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      [organizationId, id, params.fileSize, params.duration, params.objectKey ?? null]
    );
    return result.rows[0] ? mapGeneratedAudioAsset(result.rows[0]) : null;
  }

  async markFailed(organizationId: string, id: string) {
    const result = await this.db.query(
      `UPDATE generated_audio_assets
       SET status = 'failed', updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      [organizationId, id]
    );
    return result.rows[0] ? mapGeneratedAudioAsset(result.rows[0]) : null;
  }
}

export class RecordingPolicyRepository {
  constructor(private readonly db: Database) {}

  async list(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM recording_policies WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT rp.*, sl.name AS storage_location_name, sl.bucket_name
       FROM recording_policies rp
       JOIN storage_locations sl ON sl.id = rp.storage_location_id
       WHERE rp.organization_id = $1
       ORDER BY rp.created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
    );
    return {
      items: result.rows.map((row: Record<string, unknown>) => ({
        ...mapRecordingPolicy(row),
        storageLocationName: row.storage_location_name as string,
        bucketName: row.bucket_name as string,
      })),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    };
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      `SELECT rp.*, sl.name AS storage_location_name, sl.bucket_name
       FROM recording_policies rp
       JOIN storage_locations sl ON sl.id = rp.storage_location_id
       WHERE rp.organization_id = $1 AND rp.id = $2`,
      [organizationId, id]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      ...mapRecordingPolicy(row),
      storageLocationName: row.storage_location_name as string,
      bucketName: row.bucket_name as string,
    };
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      enabled?: boolean;
      storageLocationId: string;
      pathPrefix: string;
      filenameTemplate: string;
      retentionDays?: number;
      remuxToMp4?: boolean;
      keepSourceFlvHours?: number | null;
    }
  ) {
    const result = await this.db.query(
      `INSERT INTO recording_policies (
        organization_id, name, enabled, storage_location_id,
        path_prefix, filename_template, retention_days,
        remux_to_mp4, keep_source_flv_hours
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        organizationId,
        data.name,
        data.enabled ?? true,
        data.storageLocationId,
        data.pathPrefix,
        data.filenameTemplate,
        data.retentionDays ?? null,
        data.remuxToMp4 ?? false,
        data.keepSourceFlvHours ?? null,
      ]
    );
    return mapRecordingPolicy(result.rows[0]);
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      enabled: boolean;
      storageLocationId: string;
      pathPrefix: string;
      filenameTemplate: string;
      retentionDays: number | null;
      remuxToMp4: boolean;
      keepSourceFlvHours: number | null;
    }>
  ) {
    const fields: string[] = [];
    const values: unknown[] = [organizationId, id];
    let idx = 3;
    const setField = (column: string, value: unknown) => {
      fields.push(`${column} = $${idx++}`);
      values.push(value);
    };
    if (data.name !== undefined) setField('name', data.name);
    if (data.enabled !== undefined) setField('enabled', data.enabled);
    if (data.storageLocationId !== undefined) setField('storage_location_id', data.storageLocationId);
    if (data.pathPrefix !== undefined) setField('path_prefix', data.pathPrefix);
    if (data.filenameTemplate !== undefined) setField('filename_template', data.filenameTemplate);
    if (data.retentionDays !== undefined) setField('retention_days', data.retentionDays);
    if (data.remuxToMp4 !== undefined) setField('remux_to_mp4', data.remuxToMp4);
    if (data.keepSourceFlvHours !== undefined) {
      setField('keep_source_flv_hours', data.keepSourceFlvHours);
    }
    if (fields.length === 0) return this.findById(organizationId, id);
    fields.push('updated_at = CURRENT_TIMESTAMP');
    const result = await this.db.query(
      `UPDATE recording_policies SET ${fields.join(', ')}
       WHERE organization_id = $1 AND id = $2 RETURNING *`,
      values
    );
    return result.rows[0] ? mapRecordingPolicy(result.rows[0]) : null;
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM recording_policies WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export class StreamProfileRepository {
  constructor(private readonly db: Database) {}

  async list(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM stream_profiles WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT * FROM stream_profiles WHERE organization_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
    );
    return {
      items: result.rows.map(mapStreamProfile),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    };
  }

  async listAll(organizationId: string) {
    const result = await this.db.query(
      'SELECT * FROM stream_profiles WHERE organization_id = $1 ORDER BY name',
      [organizationId]
    );
    return result.rows.map(mapStreamProfile);
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM stream_profiles WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapStreamProfile(result.rows[0]) : null;
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      mode: string;
      renditions: unknown[];
      audioHandling: string;
      gatewayMapping?: Record<string, unknown>;
    }
  ) {
    const result = await this.db.query(
      `INSERT INTO stream_profiles (
        organization_id, name, mode, renditions, audio_handling, gateway_mapping
      ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        organizationId,
        data.name,
        data.mode,
        JSON.stringify(data.renditions),
        data.audioHandling,
        data.gatewayMapping ? JSON.stringify(data.gatewayMapping) : null,
      ]
    );
    return mapStreamProfile(result.rows[0]);
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      mode: string;
      renditions: unknown[];
      audioHandling: string;
      gatewayMapping: Record<string, unknown> | null;
    }>
  ) {
    const fields: string[] = [];
    const values: unknown[] = [organizationId, id];
    let idx = 3;
    const setField = (column: string, value: unknown) => {
      fields.push(`${column} = $${idx++}`);
      values.push(value);
    };
    if (data.name !== undefined) setField('name', data.name);
    if (data.mode !== undefined) setField('mode', data.mode);
    if (data.renditions !== undefined) setField('renditions', JSON.stringify(data.renditions));
    if (data.audioHandling !== undefined) setField('audio_handling', data.audioHandling);
    if (data.gatewayMapping !== undefined) {
      setField('gateway_mapping', data.gatewayMapping ? JSON.stringify(data.gatewayMapping) : null);
    }
    if (fields.length === 0) return this.findById(organizationId, id);
    fields.push('updated_at = CURRENT_TIMESTAMP');
    const result = await this.db.query(
      `UPDATE stream_profiles SET ${fields.join(', ')}
       WHERE organization_id = $1 AND id = $2 RETURNING *`,
      values
    );
    return result.rows[0] ? mapStreamProfile(result.rows[0]) : null;
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM stream_profiles WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export class AudioFeedProfileRepository {
  constructor(private readonly db: Database) {}

  async list(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM audio_feed_profiles WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT af.*, sl.name AS storage_location_name, sl.bucket_name
       FROM audio_feed_profiles af
       JOIN storage_locations sl ON sl.id = af.storage_location_id
       WHERE af.organization_id = $1
       ORDER BY af.created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
    );
    return {
      items: result.rows.map((row: Record<string, unknown>) => ({
        ...mapAudioFeedProfile(row),
        storageLocationName: row.storage_location_name as string,
        bucketName: row.bucket_name as string,
      })),
      total,
      page: safePage,
      pageSize: safeSize,
      hasMore: offset + result.rows.length < total,
    };
  }

  async listAll(organizationId: string) {
    const result = await this.db.query(
      'SELECT * FROM audio_feed_profiles WHERE organization_id = $1 ORDER BY name',
      [organizationId]
    );
    return result.rows.map(mapAudioFeedProfile);
  }

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      `SELECT af.*, sl.name AS storage_location_name, sl.bucket_name
       FROM audio_feed_profiles af
       JOIN storage_locations sl ON sl.id = af.storage_location_id
       WHERE af.organization_id = $1 AND af.id = $2`,
      [organizationId, id]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      ...mapAudioFeedProfile(row),
      storageLocationName: row.storage_location_name as string,
      bucketName: row.bucket_name as string,
    };
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      enabled?: boolean;
      outputCodecs: string[];
      outputContainer: string;
      storageLocationId: string;
      nameTemplate: string;
      generateDuringLive?: boolean;
    }
  ) {
    const result = await this.db.query(
      `INSERT INTO audio_feed_profiles (
        organization_id, name, enabled, output_codecs, output_container,
        storage_location_id, name_template, generate_during_live
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        organizationId,
        data.name,
        data.enabled ?? true,
        data.outputCodecs,
        data.outputContainer,
        data.storageLocationId,
        data.nameTemplate,
        data.generateDuringLive ?? false,
      ]
    );
    return mapAudioFeedProfile(result.rows[0]);
  }

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      enabled: boolean;
      outputCodecs: string[];
      outputContainer: string;
      storageLocationId: string;
      nameTemplate: string;
      generateDuringLive: boolean;
    }>
  ) {
    const fields: string[] = [];
    const values: unknown[] = [organizationId, id];
    let idx = 3;
    const setField = (column: string, value: unknown) => {
      fields.push(`${column} = $${idx++}`);
      values.push(value);
    };
    if (data.name !== undefined) setField('name', data.name);
    if (data.enabled !== undefined) setField('enabled', data.enabled);
    if (data.outputCodecs !== undefined) setField('output_codecs', data.outputCodecs);
    if (data.outputContainer !== undefined) setField('output_container', data.outputContainer);
    if (data.storageLocationId !== undefined) setField('storage_location_id', data.storageLocationId);
    if (data.nameTemplate !== undefined) setField('name_template', data.nameTemplate);
    if (data.generateDuringLive !== undefined) setField('generate_during_live', data.generateDuringLive);
    if (fields.length === 0) return this.findById(organizationId, id);
    fields.push('updated_at = CURRENT_TIMESTAMP');
    const result = await this.db.query(
      `UPDATE audio_feed_profiles SET ${fields.join(', ')}
       WHERE organization_id = $1 AND id = $2 RETURNING *`,
      values
    );
    return result.rows[0] ? mapAudioFeedProfile(result.rows[0]) : null;
  }

  async delete(organizationId: string, id: string) {
    const result = await this.db.query(
      'DELETE FROM audio_feed_profiles WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export class GatewayConfigRepository {
  constructor(private readonly db: Database) {}

  async getLatest(organizationId: string) {
    const result = await this.db.query(
      `SELECT * FROM gateway_config_versions
       WHERE organization_id = $1
       ORDER BY desired_version DESC
       LIMIT 1`,
      [organizationId]
    );
    return result.rows[0] ?? null;
  }

  async insertDesired(params: {
    organizationId: string;
    desiredVersion: number;
    appliedVersion: number;
    desiredConfig: unknown;
    configHash: string;
  }) {
    const result = await this.db.query(
      `INSERT INTO gateway_config_versions (
        organization_id, desired_version, applied_version, desired_config
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        params.organizationId,
        params.desiredVersion,
        params.appliedVersion,
        JSON.stringify(params.desiredConfig),
      ]
    );
    return result.rows[0];
  }

  async markSynced(versionId: string, appliedConfig: unknown) {
    await this.db.query(
      `UPDATE gateway_config_versions
       SET applied_version = desired_version,
           applied_config = $2,
           synced_at = CURRENT_TIMESTAMP,
           error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [versionId, JSON.stringify(appliedConfig)]
    );
  }

  async markError(versionId: string, error: string) {
    await this.db.query(
      `UPDATE gateway_config_versions
       SET error = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [versionId, error]
    );
  }
}

export class UserAccessRepository {
  constructor(private readonly db: Database) {}

  async listApplicationIds(organizationId: string, userId: string) {
    const result = await this.db.query(
      `SELECT application_id::text AS id
       FROM user_application_assignments
       WHERE organization_id = $1 AND user_id = $2
       ORDER BY created_at`,
      [organizationId, userId]
    );
    return result.rows.map((row: { id: string }) => String(row.id));
  }

  async listRecordingPolicyIds(organizationId: string, userId: string) {
    const result = await this.db.query(
      `SELECT recording_policy_id::text AS id
       FROM user_recording_policy_assignments
       WHERE organization_id = $1 AND user_id = $2
       ORDER BY created_at`,
      [organizationId, userId]
    );
    return result.rows.map((row: { id: string }) => String(row.id));
  }

  async listVodRouteIds(organizationId: string, userId: string) {
    const result = await this.db.query(
      `SELECT vod_route_id::text AS id
       FROM user_vod_route_assignments
       WHERE organization_id = $1 AND user_id = $2
       ORDER BY created_at`,
      [organizationId, userId]
    );
    return result.rows.map((row: { id: string }) => String(row.id));
  }

  async listDomainBlockIds(organizationId: string, userId: string) {
    const result = await this.db.query(
      `SELECT domain_block_id::text AS id
       FROM user_domain_block_assignments
       WHERE organization_id = $1 AND user_id = $2
       ORDER BY created_at`,
      [organizationId, userId]
    );
    return result.rows.map((row: { id: string }) => String(row.id));
  }

  async listStorageLocationIds(organizationId: string, userId: string) {
    const result = await this.db.query(
      `SELECT storage_location_id::text AS id
       FROM user_storage_location_assignments
       WHERE organization_id = $1 AND user_id = $2
       ORDER BY created_at`,
      [organizationId, userId]
    );
    return result.rows.map((row: { id: string }) => String(row.id));
  }

  private async assertIdsInOrg(
    table:
      | 'applications'
      | 'recording_policies'
      | 'vod_routes'
      | 'domain_blocks'
      | 'storage_locations',
    organizationId: string,
    ids: string[]
  ) {
    if (ids.length === 0) return;
    const result = await this.db.query(
      `SELECT id::text FROM ${table} WHERE organization_id = $1 AND id = ANY($2::uuid[])`,
      [organizationId, ids]
    );
    if (result.rows.length !== ids.length) {
      throw new Error(`One or more ${table} ids are invalid for this organization`);
    }
  }

  async setApplicationIds(organizationId: string, userId: string, applicationIds: string[]) {
    await this.assertIdsInOrg('applications', organizationId, applicationIds);
    await this.db.query('BEGIN');
    try {
      await this.db.query(
        'DELETE FROM user_application_assignments WHERE organization_id = $1 AND user_id = $2',
        [organizationId, userId]
      );
      for (const applicationId of applicationIds) {
        await this.db.query(
          `INSERT INTO user_application_assignments (user_id, application_id, organization_id)
           VALUES ($1, $2, $3)`,
          [userId, applicationId, organizationId]
        );
      }
      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  async setRecordingPolicyIds(organizationId: string, userId: string, policyIds: string[]) {
    await this.assertIdsInOrg('recording_policies', organizationId, policyIds);
    await this.db.query('BEGIN');
    try {
      await this.db.query(
        'DELETE FROM user_recording_policy_assignments WHERE organization_id = $1 AND user_id = $2',
        [organizationId, userId]
      );
      for (const policyId of policyIds) {
        await this.db.query(
          `INSERT INTO user_recording_policy_assignments (user_id, recording_policy_id, organization_id)
           VALUES ($1, $2, $3)`,
          [userId, policyId, organizationId]
        );
      }
      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  async setVodRouteIds(organizationId: string, userId: string, vodRouteIds: string[]) {
    await this.assertIdsInOrg('vod_routes', organizationId, vodRouteIds);
    await this.db.query('BEGIN');
    try {
      await this.db.query(
        'DELETE FROM user_vod_route_assignments WHERE organization_id = $1 AND user_id = $2',
        [organizationId, userId]
      );
      for (const vodRouteId of vodRouteIds) {
        await this.db.query(
          `INSERT INTO user_vod_route_assignments (user_id, vod_route_id, organization_id)
           VALUES ($1, $2, $3)`,
          [userId, vodRouteId, organizationId]
        );
      }
      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  async setDomainBlockIds(organizationId: string, userId: string, domainBlockIds: string[]) {
    await this.assertIdsInOrg('domain_blocks', organizationId, domainBlockIds);
    await this.db.query('BEGIN');
    try {
      await this.db.query(
        'DELETE FROM user_domain_block_assignments WHERE organization_id = $1 AND user_id = $2',
        [organizationId, userId]
      );
      for (const domainBlockId of domainBlockIds) {
        await this.db.query(
          `INSERT INTO user_domain_block_assignments (user_id, domain_block_id, organization_id)
           VALUES ($1, $2, $3)`,
          [userId, domainBlockId, organizationId]
        );
      }
      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  async setStorageLocationIds(organizationId: string, userId: string, storageLocationIds: string[]) {
    await this.assertIdsInOrg('storage_locations', organizationId, storageLocationIds);
    await this.db.query('BEGIN');
    try {
      await this.db.query(
        'DELETE FROM user_storage_location_assignments WHERE organization_id = $1 AND user_id = $2',
        [organizationId, userId]
      );
      for (const storageLocationId of storageLocationIds) {
        await this.db.query(
          `INSERT INTO user_storage_location_assignments (user_id, storage_location_id, organization_id)
           VALUES ($1, $2, $3)`,
          [userId, storageLocationId, organizationId]
        );
      }
      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw error;
    }
  }

  async addRecordingPolicyAssignment(organizationId: string, userId: string, policyId: string) {
    await this.assertIdsInOrg('recording_policies', organizationId, [policyId]);
    await this.db.query(
      `INSERT INTO user_recording_policy_assignments (user_id, recording_policy_id, organization_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [userId, policyId, organizationId]
    );
  }
}

export function createRepositories(db: Database) {
  return {
    organizations: new OrganizationRepository(db),
    applications: new ApplicationRepository(db),
    inputs: new InputRepository(db),
    userAccess: new UserAccessRepository(db),
    outputs: new OutputRepository(db),
    routes: new RouteRepository(db),
    domainBlocks: new DomainBlockRepository(db),
    users: new UserRepository(db),
    vodRoutes: new VodRouteRepository(db),
    dvrWatchlist: new DvrWatchlistRepository(db),
    storageLocations: new StorageLocationRepository(db),
    liveSessions: new LiveSessionRepository(db),
    recordingAssets: new RecordingAssetRepository(db),
    generatedAudioAssets: new GeneratedAudioAssetRepository(db),
    recordingPolicies: new RecordingPolicyRepository(db),
    streamProfiles: new StreamProfileRepository(db),
    audioFeedProfiles: new AudioFeedProfileRepository(db),
    gatewayConfig: new GatewayConfigRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
