export interface Application {
  id: string;
  name: string;
  appName: string;
  description?: string;
  inputCount?: number;
}

export interface RtspProtocolConfig {
  host?: string;
  port?: number;
  path?: string;
  username?: string;
  password?: string;
}

export interface SrtProtocolConfig {
  host?: string;
  port?: number;
  mode?: 'listener' | 'caller' | 'rendezvous';
  streamid?: string;
  username?: string;
  password?: string;
  encryptionKey?: string;
}

export type ProtocolConfig = RtspProtocolConfig | SrtProtocolConfig;

export interface Input {
  id: string;
  applicationId: string;
  name: string;
  streamKey: string;
  ingestProtocol: 'rtmp' | 'rtsp' | 'srt' | 'hls' | 'http';
  enabled: boolean;
  sourceRestrictions?: string[];
  protocolConfig?: ProtocolConfig;
  streamProfileId?: string;
  recordingPolicyId?: string;
  audioFeedProfileId?: string;
  streamProfileIds?: string[];
  recordingPolicyIds?: string[];
  audioFeedProfileIds?: string[];
  application?: Pick<Application, 'id' | 'name' | 'appName'>;
  primaryOutputId?: string;
  primaryRouteId?: string;
}

export interface LiveSessionPublisherStats {
  streamPath: string;
  publisherIp?: string;
  sourceProtocol?: string;
  videoCodec?: string;
  audioCodec?: string;
  bitrateKbps?: number;
  resolution?: string;
  uptimeSeconds?: number;
}

export interface LiveSession {
  id: string;
  inputId: string;
  gatewayApp?: string;
  streamKey: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  publisher?: LiveSessionPublisherStats | null;
}

export interface Output {
  id: string;
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

export interface Route {
  id: string;
  name: string;
  inputId: string;
  outputIds: string[];
  enabled: boolean;
}

export interface RestreamDestination {
  id: string;
  name: string;
  enabled: boolean;
  kind: 'local_watch' | 'local_mirror' | 'external';
  delivery: 'hls' | 'http-flv' | 'rtmp' | 'srt';
  copyUrl: string;
  routeTarget: string;
  gatewayApp?: string;
  gatewayStream?: string;
  externalUrl?: string;
  isSystem: boolean;
  routeId?: string;
}

export interface RestreamGroup {
  input: Input;
  destinations: RestreamDestination[];
}

export interface DomainBlock {
  id: string;
  name: string;
  slug: string;
  allowedDomains: string[];
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  playbackAccessPolicy: 'public' | 'token-required' | 'restricted';
  tokenRequired?: boolean;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  displayName?: string;
  role: 'super-admin' | 'admin' | 'manager';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StorageLocation {
  id: string;
  name: string;
  type: string;
  bucketName: string;
  prefixPath: string;
  isDefault: boolean;
  endpoint?: string;
  region?: string;
  useSsl?: boolean;
  publicEndpoint?: string;
  pathStyle?: boolean;
  hasCredentials?: boolean;
}

export interface RecordingPolicy {
  id: string;
  name: string;
  enabled: boolean;
  storageLocationId: string;
  pathPrefix: string;
  filenameTemplate: string;
  storageLocationName?: string;
  bucketName?: string;
  retentionDays?: number;
  remuxToMp4?: boolean;
  keepSourceFlvHours?: number;
}

export interface StreamProfile {
  id: string;
  name: string;
  mode: 'passthrough' | 'transcode';
  audioHandling: 'copy' | 'aac' | 'opus' | string;
  renditions?: Array<{
    name: string;
    resolution: string;
    videoBitrate: number;
    videoCodec?: string;
    fps: number;
  }>;
}

export interface AudioFeedProfile {
  id: string;
  name: string;
  enabled: boolean;
  outputContainer: string;
  outputCodecs: string[];
  storageLocationName?: string;
  generateDuringLive: boolean;
}

export interface DvrWatchlistEntry {
  id: string;
  organizationId: string;
  applicationId?: string;
  applicationName?: string;
  streamPattern?: string;
  retentionHours: number;
  storageLocationId: string;
  storageLocationName?: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecordingAsset {
  id: string;
  organizationId?: string;
  liveSessionId?: string;
  recordingPolicyId?: string;
  applicationId?: string;
  applicationName?: string;
  inputId?: string;
  inputName?: string;
  streamKey?: string;
  recordingPath?: string;
  objectKey: string;
  status: string;
  duration: number;
  fileSize: number;
  storageLocation?: string;
  startedAt?: string;
  finishedAt?: string;
  metadata?: Record<string, unknown>;
  recordingPolicyName?: string;
  playbackFormats?: Array<'hls' | 'flv' | 'mp4'>;
  finalizedContainer?: string;
  hasHls?: boolean;
  videoCodec?: string;
  audioCodec?: string;
  resolution?: string;
  bitrateKbps?: number;
}

export interface RecordingPlaybackAudioAsset {
  id: string;
  codec: string;
  duration: number;
  fileSize: number;
  previewUrl: string;
}

export interface RecordingPlaybackInfo {
  format: string;
  previewUrl: string;
  shareUrl: string;
  expiresInSeconds: number;
  audioAssets: RecordingPlaybackAudioAsset[];
}

export interface LivePlaybackInfo {
  token: string;
  expiresAt: string;
  expiresInSeconds: number;
  hlsUrl: string;
  flvUrl: string;
  embedUrl: string;
}

/** Resolved SRS playback paths for operator preview (from GET /api/playback/resolve). */
export interface LivePlaybackResolve {
  active: boolean;
  playable: boolean;
  vhost: string;
  app: string;
  stream: string;
  monitorFlvUrl: string;
  playerHlsUrl: string;
  protectedHlsUrl: string;
  protectedFlvUrl: string;
}

export interface VodRoute {
  id: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface VodRoutePlaybackInfo {
  previewUrl: string;
  shareUrl: string;
  embedUrl: string;
  token?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
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

export interface UserAccess {
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
}

export interface UserAccessAssignment {
  applicationIds: string[];
  recordingPolicyIds: string[];
  vodRouteIds: string[];
  domainBlockIds: string[];
  storageLocationIds: string[];
}

export interface AuthResponse {
  token: string;
  user: User;
  access: UserAccess;
}

export interface CurrentUserResponse {
  user: User;
  access: UserAccess;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
