import {
  mapApplication,
  mapAudioFeedProfile,
  mapDomainBlock,
  mapGeneratedAudioAsset,
  mapInput,
  mapLiveSession,
  mapOrganization,
  mapOutput,
  mapRecordingAsset,
  mapRecordingPolicy,
  mapRoute,
  mapStorageLocation,
  mapStorageLocationWithSecrets,
  mapStreamProfile,
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

const INPUT_SELECT = `SELECT i.*, a.name AS application_name, a.app_name AS application_app_name
  FROM inputs i
  INNER JOIN applications a ON a.id = i.application_id`;

export class ApplicationRepository {
  constructor(private readonly db: Database) {}

  async list(organizationId: string, params: PaginationParams = {}) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const count = await this.db.query(
      'SELECT COUNT(*)::int AS total FROM applications WHERE organization_id = $1',
      [organizationId]
    );
    const total = count.rows[0].total as number;
    const result = await this.db.query(
      `SELECT a.*,
        (SELECT COUNT(*)::int FROM inputs WHERE application_id = a.id) AS input_count
       FROM applications a
       WHERE a.organization_id = $1
       ORDER BY a.name
       LIMIT $2 OFFSET $3`,
      [organizationId, safeSize, offset]
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

  async list(
    organizationId: string,
    params: PaginationParams & { applicationId?: string } = {}
  ) {
    const { safePage, safeSize, offset } = paginationClause(params.page, params.pageSize);
    const filters = ['i.organization_id = $1'];
    const values: unknown[] = [organizationId];
    let index = 2;

    if (params.applicationId) {
      filters.push(`i.application_id = $${index}`);
      values.push(params.applicationId);
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
    }
  ) {
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
        data.streamProfileId ?? null,
        data.recordingPolicyId ?? null,
        data.audioFeedProfileId ?? null,
      ]
    );
    const created = result.rows[0];
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

    if (fields.length === 0) {
      return this.findById(organizationId, id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    const result = await this.db.query(
      `UPDATE inputs SET ${fields.join(', ')}
       WHERE organization_id = $1 AND id = $2
       RETURNING id`,
      values
    );
    if (!result.rows[0]) return null;
    return this.findById(organizationId, String(result.rows[0].id));
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

  async findById(organizationId: string, id: string) {
    const result = await this.db.query(
      'SELECT * FROM recording_assets WHERE organization_id = $1 AND id = $2',
      [organizationId, id]
    );
    return result.rows[0] ? mapRecordingAsset(result.rows[0]) : null;
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
    recordingAssetId?: string;
    liveSessionId: string;
    audioFeedProfileId: string;
    codec: string;
    objectKey: string;
  }) {
    const scope = params.recordingAssetId ? `recording:${params.recordingAssetId}` : `session:${params.liveSessionId}`;
    return `${scope}:${params.audioFeedProfileId}:${params.codec}:${params.objectKey}`;
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

export function createRepositories(db: Database) {
  return {
    organizations: new OrganizationRepository(db),
    applications: new ApplicationRepository(db),
    inputs: new InputRepository(db),
    outputs: new OutputRepository(db),
    routes: new RouteRepository(db),
    domainBlocks: new DomainBlockRepository(db),
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
