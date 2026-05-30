export interface Application {
  id: string;
  name: string;
  appName: string;
  description?: string;
  inputCount?: number;
}

export interface Input {
  id: string;
  applicationId: string;
  name: string;
  streamKey: string;
  ingestProtocol: 'rtmp' | 'rtsp' | 'hls' | 'http';
  enabled: boolean;
  streamProfileId?: string;
  recordingPolicyId?: string;
  audioFeedProfileId?: string;
  application?: Pick<Application, 'id' | 'name' | 'appName'>;
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
  playbackAccessPolicy: string;
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
  audioHandling: string;
  renditions?: Array<{ name: string; resolution: string }>;
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

export interface RecordingAsset {
  id: string;
  objectKey: string;
  status: string;
  duration: number;
  fileSize: number;
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

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
