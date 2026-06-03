// Database utilities and connection management

import { Pool, PoolClient } from 'pg';

export { runMigrations, resolveMigrationsDir } from './migrate';
export * from './mapper';
export * from './repositories';
export * from './gateway-reconciliation';
export * from './audio-orchestration';

export interface DatabaseConfig {
  connectionString: string;
  max?: number;
  idleTimeoutMillis?: number;
}

export class Database {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.max ?? 20,
      idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    });
  }

  async connect(): Promise<void> {
    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT NOW()');
    } finally {
      client.release();
    }
  }

  async query(sql: string, params?: unknown[]): Promise<any> {
    return this.pool.query(sql, params);
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Schema definitions
export const SCHEMA = {
  organizations: `
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  inputs: `
    CREATE TABLE IF NOT EXISTS inputs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      stream_key VARCHAR(255) NOT NULL,
      ingest_protocol VARCHAR(50) NOT NULL,
      enabled BOOLEAN DEFAULT true,
      source_restrictions JSONB,
      stream_profile_id UUID,
      recording_policy_id UUID,
      audio_feed_profile_id UUID,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, stream_key)
    )
  `,
  outputs: `
    CREATE TABLE IF NOT EXISTS outputs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      route_target VARCHAR(255) NOT NULL,
      playback_protocol VARCHAR(50) NOT NULL,
      gateway_app_name VARCHAR(255) NOT NULL,
      gateway_stream_name VARCHAR(255) NOT NULL,
      domain_block_id UUID,
      stream_profile_id UUID,
      enabled BOOLEAN DEFAULT true,
      is_public BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  routes: `
    CREATE TABLE IF NOT EXISTS routes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      input_id UUID NOT NULL REFERENCES inputs(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      enabled BOOLEAN DEFAULT true,
      output_ids UUID[] NOT NULL,
      stream_profile_id UUID,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  live_sessions: `
    CREATE TABLE IF NOT EXISTS live_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      input_id UUID NOT NULL REFERENCES inputs(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      stream_key VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      started_at TIMESTAMP NOT NULL,
      ended_at TIMESTAMP,
      bitrate INTEGER,
      resolution VARCHAR(50),
      fps INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  recording_assets: `
    CREATE TABLE IF NOT EXISTS recording_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
      recording_policy_id UUID NOT NULL,
      status VARCHAR(50) NOT NULL,
      storage_location VARCHAR(255) NOT NULL,
      object_key VARCHAR(1024) NOT NULL,
      duration INTEGER NOT NULL,
      file_size BIGINT NOT NULL,
      started_at TIMESTAMP NOT NULL,
      finished_at TIMESTAMP,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  generated_audio_assets: `
    CREATE TABLE IF NOT EXISTS generated_audio_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      recording_asset_id UUID REFERENCES recording_assets(id) ON DELETE CASCADE,
      live_session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
      audio_feed_profile_id UUID NOT NULL,
      dedupe_key VARCHAR(1024) NOT NULL,
      codec VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL,
      storage_location VARCHAR(255) NOT NULL,
      object_key VARCHAR(1024) NOT NULL,
      file_size BIGINT NOT NULL,
      duration INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, dedupe_key)
    )
  `,
  storage_locations: `
    CREATE TABLE IF NOT EXISTS storage_locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      bucket_name VARCHAR(255) NOT NULL,
      prefix_path VARCHAR(1024),
      local_path TEXT,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  recording_policies: `
    CREATE TABLE IF NOT EXISTS recording_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      enabled BOOLEAN DEFAULT true,
      storage_location_id UUID NOT NULL REFERENCES storage_locations(id),
      archive_storage_location_id UUID REFERENCES storage_locations(id) ON DELETE SET NULL,
      path_prefix VARCHAR(1024) NOT NULL,
      archive_path_prefix VARCHAR(1024),
      filename_template VARCHAR(1024) NOT NULL,
      retention_days INTEGER,
      segmentation_options JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  audio_feed_profiles: `
    CREATE TABLE IF NOT EXISTS audio_feed_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      enabled BOOLEAN DEFAULT true,
      output_codecs VARCHAR(50)[] NOT NULL,
      output_container VARCHAR(50) NOT NULL,
      storage_location_id UUID NOT NULL REFERENCES storage_locations(id),
      name_template VARCHAR(1024) NOT NULL,
      generate_during_live BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  domain_blocks: `
    CREATE TABLE IF NOT EXISTS domain_blocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      allowed_domains VARCHAR(255)[] NOT NULL,
      branding JSONB,
      playback_access_policy VARCHAR(50) NOT NULL,
      token_required BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, slug)
    )
  `,
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      display_name VARCHAR(255),
      password_hash TEXT,
      role VARCHAR(50) NOT NULL DEFAULT 'manager',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, email),
      CHECK (role IN ('super-admin', 'admin', 'manager'))
    )
  `,
  vod_routes: `
    CREATE TABLE IF NOT EXISTS vod_routes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      enabled BOOLEAN DEFAULT true,
      request_domain VARCHAR(255),
      public_path VARCHAR(1024) NOT NULL,
      delivery_type VARCHAR(50) NOT NULL,
      source_type VARCHAR(50) NOT NULL,
      storage_location_id UUID REFERENCES storage_locations(id) ON DELETE SET NULL,
      source_path VARCHAR(2048) NOT NULL,
      domain_block_id UUID REFERENCES domain_blocks(id) ON DELETE SET NULL,
      allow_direct_access BOOLEAN DEFAULT false,
      generate_iframe_playlist BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, public_path)
    )
  `,
  stream_profiles: `
    CREATE TABLE IF NOT EXISTS stream_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      mode VARCHAR(50) NOT NULL,
      renditions JSONB NOT NULL,
      audio_handling VARCHAR(50) NOT NULL,
      gateway_mapping JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  jobs: `
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      type VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL,
      payload JSONB NOT NULL,
      result JSONB,
      error TEXT,
      retries INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      scheduled_for TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (organization_id, status)
    )
  `,
  gateway_config_versions: `
    CREATE TABLE IF NOT EXISTS gateway_config_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      desired_version INTEGER NOT NULL,
      applied_version INTEGER NOT NULL,
      desired_config JSONB NOT NULL,
      applied_config JSONB,
      synced_at TIMESTAMP,
      error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, desired_version)
    )
  `,
};
