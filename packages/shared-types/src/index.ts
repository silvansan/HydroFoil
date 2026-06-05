// Shared types and interfaces for HydroFoil

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
}

/** SRS ingest application — event, venue, or organization bucket for stream keys */
export interface Application extends BaseEntity {
  organizationId: string;
  name: string;
  appName: string;
  description?: string;
  inputCount?: number;
}

export interface Input extends BaseEntity {
  organizationId: string;
  applicationId: string;
  name: string;
  streamKey: string;
  ingestProtocol: 'rtmp' | 'rtsp' | 'hls' | 'http';
  enabled: boolean;
  sourceRestrictions?: string[];
  streamProfileId?: string;
  recordingPolicyId?: string;
  audioFeedProfileId?: string;
  streamProfileIds?: string[];
  recordingPolicyIds?: string[];
  audioFeedProfileIds?: string[];
  application?: Pick<Application, 'id' | 'name' | 'appName'>;
}

export interface Output extends BaseEntity {
  organizationId: string;
  name: string;
  routeTarget: string;
  playbackProtocol: 'hls' | 'dash' | 'rtmp' | 'http-flv';
  gatewayAppName: string;
  gatewayStreamName: string;
  domainBlockId?: string;
  streamProfileId?: string;
  enabled: boolean;
  isPublic: boolean;
}

export interface Route extends BaseEntity {
  organizationId: string;
  inputId: string;
  name: string;
  enabled: boolean;
  outputIds: string[];
  streamProfileId?: string;
}

export interface StreamProfile extends BaseEntity {
  organizationId: string;
  name: string;
  mode: 'passthrough' | 'transcode';
  renditions: Rendition[];
  audioHandling: 'copy' | 'aac' | 'opus';
  gatewayMapping?: Record<string, unknown>;
}

export interface Rendition {
  name: string;
  videoBitrate: number;
  videoCodec: string;
  resolution: string;
  fps: number;
}

export interface DomainBlock extends BaseEntity {
  organizationId: string;
  name: string;
  slug: string;
  allowedDomains: string[];
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  playbackAccessPolicy: 'public' | 'token-required' | 'restricted';
  tokenRequired: boolean;
}

export interface User extends BaseEntity {
  organizationId: string;
  email: string;
  displayName?: string;
  role: 'super-admin' | 'admin' | 'manager';
  isActive: boolean;
}

export interface VodRoute extends BaseEntity {
  organizationId: string;
  name: string;
  enabled: boolean;
  requestDomain?: string;
  publicPath: string;
  deliveryType: 'hls' | 'progressive';
  sourceType: 'storage-location' | 'remote-http';
  storageLocationId?: string;
  sourcePath: string;
  domainBlockId?: string;
  allowDirectAccess: boolean;
  generateIframePlaylist: boolean;
}

export interface DvrWatchlistEntry extends BaseEntity {
  organizationId: string;
  applicationId?: string;
  applicationName?: string;
  streamPattern?: string;
  retentionHours: number;
  storageLocationId: string;
  enabled: boolean;
}

export interface RecordingPolicy extends BaseEntity {
  organizationId: string;
  name: string;
  enabled: boolean;
  storageLocationId: string;
  pathPrefix: string;
  filenameTemplate: string;
  retentionDays?: number;
  segmentationOptions?: {
    segmentDurationSeconds?: number;
    keepRaw: boolean;
  };
  remuxToMp4?: boolean;
  keepSourceFlvHours?: number;
}

export interface AudioFeedProfile extends BaseEntity {
  organizationId: string;
  name: string;
  enabled: boolean;
  outputCodecs: ('mp3' | 'aac' | 'opus')[];
  outputContainer: 'mp3' | 'aac' | 'ogg' | 'hls';
  storageLocationId: string;
  nameTemplate: string;
  generateDuringLive: boolean;
}

export interface StorageLocation extends BaseEntity {
  organizationId: string;
  name: string;
  type: 'minio' | 'local' | 's3';
  bucketName: string;
  prefixPath: string;
  isDefault: boolean;
}

export interface LiveSession extends BaseEntity {
  inputId: string;
  organizationId: string;
  gatewayApp?: string;
  streamKey: string;
  status: 'publishing' | 'idle' | 'recording';
  startedAt: Date;
  endedAt?: Date;
  bitrate?: number;
  resolution?: string;
  fps?: number;
}

export interface RecordingAsset extends BaseEntity {
  organizationId: string;
  liveSessionId: string;
  recordingPolicyId: string;
  status: 'recording' | 'finalizing' | 'ready' | 'failed';
  storageLocation: string;
  objectKey: string;
  duration: number;
  fileSize: number;
  startedAt: Date;
  finishedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface GeneratedAudioAsset extends BaseEntity {
  organizationId: string;
  recordingAssetId?: string;
  liveSessionId?: string;
  audioFeedProfileId: string;
  codec: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  storageLocation: string;
  objectKey: string;
  fileSize: number;
  duration: number;
  createdAt: Date;
}

export interface Job extends BaseEntity {
  organizationId: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  retries: number;
  maxRetries: number;
  scheduledFor?: Date;
  completedAt?: Date;
}

export interface GatewayConfigVersion extends BaseEntity {
  organizationId: string;
  desiredVersion: number;
  appliedVersion: number;
  desiredConfig: Record<string, unknown>;
  appliedConfig?: Record<string, unknown>;
  syncedAt?: Date;
  error?: string;
}

export interface SystemCpuTelemetry {
  usagePercent: number | null;
  loadAverage1m: number;
  loadAverage5m: number;
  loadAverage15m: number;
  coreCount: number;
  model: string;
  sampledAt: string;
}

export interface SystemMemoryTelemetry {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usagePercent: number;
  processRssBytes: number;
  sampledAt: string;
}

export interface SystemGpuDeviceTelemetry {
  name: string;
  utilizationPercent: number | null;
  memoryTotalBytes: number | null;
  memoryUsedBytes: number | null;
  memoryUsagePercent: number | null;
  temperatureC: number | null;
  driverVersion?: string;
}

export interface SystemGpuTelemetry {
  available: boolean;
  vendor?: string;
  devices: SystemGpuDeviceTelemetry[];
  note?: string;
  sampledAt: string;
}

export interface SystemTelemetry {
  host: {
    hostname: string;
    platform: string;
    arch: string;
    uptimeSeconds: number;
  };
  cpu: SystemCpuTelemetry;
  memory: SystemMemoryTelemetry;
  gpu: SystemGpuTelemetry;
}

export interface BandwidthHistorySample {
  recordedAt: string;
  totalKbps: number;
  streamCount: number;
}

export interface BandwidthHistoryResponse {
  hours: number;
  intervalSeconds: number;
  samples: BandwidthHistorySample[];
}

// API Request/Response types
export interface CreateApplicationRequest {
  name: string;
  appName?: string;
  description?: string;
}

export interface CreateInputRequest {
  applicationId: string;
  name: string;
  streamKey: string;
  ingestProtocol: Input['ingestProtocol'];
  enabled?: boolean;
  sourceRestrictions?: string[];
  streamProfileId?: string;
  recordingPolicyId?: string;
  audioFeedProfileId?: string;
}

export interface CreateOutputRequest {
  name: string;
  routeTarget: string;
  playbackProtocol: Output['playbackProtocol'];
  gatewayAppName: string;
  gatewayStreamName: string;
  domainBlockId?: string;
  streamProfileId?: string;
  enabled?: boolean;
  isPublic?: boolean;
}

export interface CreateRouteRequest {
  inputId: string;
  name: string;
  outputIds: string[];
  streamProfileId?: string;
  enabled?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
