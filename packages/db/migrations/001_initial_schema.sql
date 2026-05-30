-- HydroFoil Database Schema
-- Initial migration to create all core tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations (multi-tenant boundary)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Storage Locations (MinIO buckets and prefixes)
CREATE TABLE storage_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'minio', -- minio, local, s3
  bucket_name VARCHAR(255) NOT NULL,
  prefix_path VARCHAR(1024),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT storage_locations_org_name_unique UNIQUE (organization_id, name)
);

-- Stream Profiles (rendition definitions)
CREATE TABLE stream_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  mode VARCHAR(50) NOT NULL DEFAULT 'passthrough', -- passthrough, transcode
  renditions JSONB NOT NULL DEFAULT '[]',
  audio_handling VARCHAR(50) NOT NULL DEFAULT 'copy', -- copy, aac, opus
  gateway_mapping JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT stream_profiles_org_name_unique UNIQUE (organization_id, name)
);

-- Recording Policies (per-stream recording behavior)
CREATE TABLE recording_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  storage_location_id UUID NOT NULL REFERENCES storage_locations(id),
  path_prefix VARCHAR(1024) NOT NULL,
  filename_template VARCHAR(1024) NOT NULL,
  retention_days INTEGER,
  segmentation_options JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT recording_policies_org_name_unique UNIQUE (organization_id, name)
);

-- Audio Feed Profiles (generated audio rules)
CREATE TABLE audio_feed_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  output_codecs VARCHAR(50)[] NOT NULL DEFAULT ARRAY['mp3'],
  output_container VARCHAR(50) NOT NULL,
  storage_location_id UUID NOT NULL REFERENCES storage_locations(id),
  name_template VARCHAR(1024) NOT NULL,
  generate_during_live BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audio_feed_profiles_org_name_unique UNIQUE (organization_id, name)
);

-- Inputs (ingest sources)
CREATE TABLE inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  stream_key VARCHAR(255) NOT NULL,
  ingest_protocol VARCHAR(50) NOT NULL DEFAULT 'rtmp', -- rtmp, rtsp, hls, http
  enabled BOOLEAN DEFAULT true,
  source_restrictions JSONB,
  stream_profile_id UUID REFERENCES stream_profiles(id),
  recording_policy_id UUID REFERENCES recording_policies(id),
  audio_feed_profile_id UUID REFERENCES audio_feed_profiles(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inputs_org_stream_key_unique UNIQUE (organization_id, stream_key),
  CONSTRAINT inputs_org_name_unique UNIQUE (organization_id, name)
);

-- Domain Blocks (access policy and branding)
CREATE TABLE domain_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  allowed_domains VARCHAR(255)[] NOT NULL,
  branding JSONB,
  playback_access_policy VARCHAR(50) NOT NULL DEFAULT 'public',
  token_required BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT domain_blocks_org_slug_unique UNIQUE (organization_id, slug),
  CONSTRAINT domain_blocks_org_name_unique UNIQUE (organization_id, name)
);

-- Outputs (playback destinations)
CREATE TABLE outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  route_target VARCHAR(255) NOT NULL,
  playback_protocol VARCHAR(50) NOT NULL, -- hls, dash, rtmp, http-flv
  gateway_app_name VARCHAR(255) NOT NULL,
  gateway_stream_name VARCHAR(255) NOT NULL,
  domain_block_id UUID REFERENCES domain_blocks(id),
  stream_profile_id UUID REFERENCES stream_profiles(id),
  enabled BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT outputs_org_name_unique UNIQUE (organization_id, name)
);

-- Routes (input to output mappings)
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  input_id UUID NOT NULL REFERENCES inputs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  output_ids UUID[] NOT NULL,
  stream_profile_id UUID REFERENCES stream_profiles(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT routes_org_name_unique UNIQUE (organization_id, name)
);

-- Live Sessions (active publishing sessions)
CREATE TABLE live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_id UUID NOT NULL REFERENCES inputs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stream_key VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'publishing', -- publishing, idle, recording
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  bitrate INTEGER,
  resolution VARCHAR(50),
  fps INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX live_sessions_org_idx ON live_sessions(organization_id);
CREATE INDEX live_sessions_input_idx ON live_sessions(input_id);
CREATE INDEX live_sessions_status_idx ON live_sessions(status);

-- Recording Assets (finalized DVR recordings)
CREATE TABLE recording_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  recording_policy_id UUID NOT NULL REFERENCES recording_policies(id),
  status VARCHAR(50) NOT NULL DEFAULT 'recording', -- recording, finalizing, ready, failed
  storage_location VARCHAR(255) NOT NULL,
  object_key VARCHAR(1024) NOT NULL,
  duration INTEGER NOT NULL,
  file_size BIGINT NOT NULL,
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX recording_assets_org_idx ON recording_assets(organization_id);
CREATE INDEX recording_assets_session_idx ON recording_assets(live_session_id);
CREATE INDEX recording_assets_status_idx ON recording_assets(status);

-- Generated Audio Assets (audio derivatives)
CREATE TABLE generated_audio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recording_asset_id UUID REFERENCES recording_assets(id) ON DELETE CASCADE,
  live_session_id UUID REFERENCES live_sessions(id) ON DELETE CASCADE,
  audio_feed_profile_id UUID NOT NULL REFERENCES audio_feed_profiles(id),
  codec VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, ready, failed
  storage_location VARCHAR(255) NOT NULL,
  object_key VARCHAR(1024) NOT NULL,
  file_size BIGINT NOT NULL,
  duration INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX generated_audio_assets_org_idx ON generated_audio_assets(organization_id);
CREATE INDEX generated_audio_assets_recording_idx ON generated_audio_assets(recording_asset_id);
CREATE INDEX generated_audio_assets_session_idx ON generated_audio_assets(live_session_id);
CREATE INDEX generated_audio_assets_status_idx ON generated_audio_assets(status);

-- Jobs (queue job tracking)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  payload JSONB NOT NULL,
  result JSONB,
  error TEXT,
  retries INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_for TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX jobs_org_status_idx ON jobs(organization_id, status);
CREATE INDEX jobs_type_idx ON jobs(type);
CREATE INDEX jobs_scheduled_idx ON jobs(scheduled_for);

-- Gateway Config Versions (desired vs applied SRS/gateway config)
CREATE TABLE gateway_config_versions (
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
  CONSTRAINT gateway_config_versions_org_desired_unique UNIQUE (organization_id, desired_version)
);

-- Create indexes for common queries
CREATE INDEX inputs_organization_idx ON inputs(organization_id);
CREATE INDEX outputs_organization_idx ON outputs(organization_id);
CREATE INDEX routes_organization_idx ON routes(organization_id);
CREATE INDEX domain_blocks_organization_idx ON domain_blocks(organization_id);
CREATE INDEX storage_locations_organization_idx ON storage_locations(organization_id);
CREATE INDEX recording_policies_organization_idx ON recording_policies(organization_id);
CREATE INDEX audio_feed_profiles_organization_idx ON audio_feed_profiles(organization_id);
CREATE INDEX stream_profiles_organization_idx ON stream_profiles(organization_id);
CREATE INDEX gateway_config_versions_org_idx ON gateway_config_versions(organization_id);
