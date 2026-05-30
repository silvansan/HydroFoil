/** Map snake_case Postgres rows to camelCase API objects */

export function mapTimestamps<T extends Record<string, unknown>>(row: T) {
  const out = { ...row } as Record<string, unknown>;
  if (row.created_at) {
    out.createdAt = new Date(String(row.created_at));
    delete out.created_at;
  }
  if (row.updated_at) {
    out.updatedAt = new Date(String(row.updated_at));
    delete out.updated_at;
  }
  if (row.started_at) {
    out.startedAt = new Date(String(row.started_at));
    delete out.started_at;
  }
  if (row.ended_at && row.ended_at !== null) {
    out.endedAt = new Date(String(row.ended_at));
    delete out.ended_at;
  }
  if (row.finished_at && row.finished_at !== null) {
    out.finishedAt = new Date(String(row.finished_at));
    delete out.finished_at;
  }
  if (row.synced_at && row.synced_at !== null) {
    out.syncedAt = new Date(String(row.synced_at));
    delete out.synced_at;
  }
  return out;
}

export function mapOrganization(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  return {
    id: String(mapped.id),
    name: String(mapped.name),
    slug: String(mapped.slug),
    description: mapped.description ?? undefined,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export function mapApplication(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  return {
    id: String(mapped.id),
    organizationId: String(mapped.organization_id),
    name: String(mapped.name),
    appName: String(mapped.app_name),
    description: mapped.description != null ? String(mapped.description) : undefined,
    inputCount:
      mapped.input_count != null ? Number(mapped.input_count) : undefined,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export function mapInput(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  const applicationId = mapped.application_id ? String(mapped.application_id) : undefined;
  const applicationAppName = mapped.application_app_name
    ? String(mapped.application_app_name)
    : undefined;
  const applicationName = mapped.application_name ? String(mapped.application_name) : undefined;

  return {
    id: String(mapped.id),
    organizationId: String(mapped.organization_id),
    applicationId: applicationId ?? '',
    name: String(mapped.name),
    streamKey: String(mapped.stream_key),
    ingestProtocol: mapped.ingest_protocol,
    enabled: mapped.enabled,
    sourceRestrictions: mapped.source_restrictions ?? undefined,
    streamProfileId: mapped.stream_profile_id ?? undefined,
    recordingPolicyId: mapped.recording_policy_id ?? undefined,
    audioFeedProfileId: mapped.audio_feed_profile_id ?? undefined,
    application:
      applicationId && applicationAppName
        ? {
            id: applicationId,
            name: applicationName ?? applicationAppName,
            appName: applicationAppName,
          }
        : undefined,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export function mapOutput(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  return {
    id: String(mapped.id),
    organizationId: mapped.organization_id,
    name: mapped.name,
    routeTarget: mapped.route_target,
    playbackProtocol: mapped.playback_protocol,
    gatewayAppName: mapped.gateway_app_name,
    gatewayStreamName: mapped.gateway_stream_name,
    domainBlockId: mapped.domain_block_id ?? undefined,
    streamProfileId: mapped.stream_profile_id ?? undefined,
    enabled: mapped.enabled,
    isPublic: mapped.is_public,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export function mapRoute(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  return {
    id: String(mapped.id),
    organizationId: mapped.organization_id,
    inputId: mapped.input_id,
    name: mapped.name,
    enabled: mapped.enabled,
    outputIds: mapped.output_ids,
    streamProfileId: mapped.stream_profile_id ?? undefined,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export function mapDomainBlock(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  return {
    id: mapped.id,
    organizationId: mapped.organization_id,
    name: mapped.name,
    slug: mapped.slug,
    allowedDomains: mapped.allowed_domains,
    branding: mapped.branding ?? undefined,
    playbackAccessPolicy: mapped.playback_access_policy,
    tokenRequired: mapped.token_required,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export function mapStorageLocation(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  return {
    id: String(mapped.id),
    organizationId: String(mapped.organization_id),
    name: String(mapped.name),
    type: String(mapped.type),
    bucketName: String(mapped.bucket_name),
    prefixPath: mapped.prefix_path != null ? String(mapped.prefix_path) : '',
    isDefault: Boolean(mapped.is_default),
    endpoint: mapped.endpoint != null ? String(mapped.endpoint) : undefined,
    region: mapped.region != null ? String(mapped.region) : undefined,
    useSsl: Boolean(mapped.use_ssl),
    publicEndpoint: mapped.public_endpoint != null ? String(mapped.public_endpoint) : undefined,
    pathStyle: mapped.path_style == null ? true : Boolean(mapped.path_style),
    hasCredentials: Boolean(mapped.access_key && mapped.secret_key),
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export function mapStorageLocationWithSecrets(row: Record<string, unknown>) {
  return {
    ...mapStorageLocation(row),
    accessKey: row.access_key != null ? String(row.access_key) : undefined,
    secretKey: row.secret_key != null ? String(row.secret_key) : undefined,
  };
}

export function mapRecordingPolicy(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  return {
    id: mapped.id,
    organizationId: mapped.organization_id,
    name: mapped.name,
    enabled: mapped.enabled,
    storageLocationId: mapped.storage_location_id,
    pathPrefix: mapped.path_prefix,
    filenameTemplate: mapped.filename_template,
    retentionDays: mapped.retention_days ?? undefined,
    segmentationOptions: mapped.segmentation_options ?? undefined,
    remuxToMp4: Boolean(mapped.remux_to_mp4),
    keepSourceFlvHours:
      mapped.keep_source_flv_hours != null ? Number(mapped.keep_source_flv_hours) : undefined,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export function mapStreamProfile(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  return {
    id: mapped.id,
    organizationId: mapped.organization_id,
    name: mapped.name,
    mode: mapped.mode,
    renditions: mapped.renditions,
    audioHandling: mapped.audio_handling,
    gatewayMapping: mapped.gateway_mapping ?? undefined,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export function mapAudioFeedProfile(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  return {
    id: mapped.id,
    organizationId: mapped.organization_id,
    name: mapped.name,
    enabled: mapped.enabled,
    outputCodecs: mapped.output_codecs,
    outputContainer: mapped.output_container,
    storageLocationId: mapped.storage_location_id,
    nameTemplate: mapped.name_template,
    generateDuringLive: mapped.generate_during_live,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export function mapLiveSession(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  return {
    id: String(mapped.id),
    inputId: mapped.input_id,
    organizationId: mapped.organization_id,
    gatewayApp: mapped.gateway_app != null ? String(mapped.gateway_app) : undefined,
    streamKey: mapped.stream_key,
    status: mapped.status,
    startedAt: mapped.startedAt,
    endedAt: mapped.endedAt,
    bitrate: mapped.bitrate ?? undefined,
    resolution: mapped.resolution ?? undefined,
    fps: mapped.fps ?? undefined,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export function mapRecordingAsset(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  return {
    id: mapped.id,
    organizationId: mapped.organization_id,
    liveSessionId: mapped.live_session_id,
    recordingPolicyId: mapped.recording_policy_id,
    status: mapped.status,
    storageLocation: mapped.storage_location,
    objectKey: mapped.object_key,
    duration: mapped.duration,
    fileSize: Number(mapped.file_size),
    startedAt: mapped.startedAt,
    finishedAt: mapped.finishedAt,
    metadata: mapped.metadata ?? undefined,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}

export function mapGeneratedAudioAsset(row: Record<string, unknown>) {
  const mapped = mapTimestamps(row);
  return {
    id: mapped.id,
    organizationId: mapped.organization_id,
    recordingAssetId: mapped.recording_asset_id ?? undefined,
    liveSessionId: mapped.live_session_id ?? undefined,
    audioFeedProfileId: mapped.audio_feed_profile_id,
    codec: mapped.codec,
    status: mapped.status,
    storageLocation: mapped.storage_location,
    objectKey: mapped.object_key,
    fileSize: Number(mapped.file_size),
    duration: Number(mapped.duration),
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt,
  };
}
