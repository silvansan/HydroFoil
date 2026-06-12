import type {
  AudioFeedProfile,
  Application,
  AuthResponse,
  CurrentUserResponse,
  DomainBlock,
  DvrWatchlistEntry,
  Input,
  InputPlaybackShare,
  LivePlaybackInfo,
  LivePlaybackResolve,
  LiveSession,
  Output,
  Paginated,
  RecordingAsset,
  RecordingPlaybackInfo,
  RecordingPolicy,
  RestreamDestination,
  RestreamGroup,
  Route,
  StorageLocation,
  StreamProfile,
  BandwidthHistoryResponse,
  CpuHistoryResponse,
  SystemTelemetry,
  User,
  UserAccess,
  UserAccessAssignment,
  VodRoute,
  VodRoutePlaybackInfo,
} from './types';
import { formatApiError } from '../lib/api-error';

const API_BASE = '';
const TOKEN_KEY = 'hf_auth_token';

export const AUTH_SESSION_EXPIRED_EVENT = 'hydrofoil:auth-session-expired';

export class AuthSessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please sign in again.');
    this.name = 'AuthSessionExpiredError';
  }
}

export function isAuthSessionExpiredError(err: unknown): err is AuthSessionExpiredError {
  return err instanceof AuthSessionExpiredError;
}

let sessionExpiredNotified = false;

export function resetAuthSessionExpiredState() {
  sessionExpiredNotified = false;
}

function isPublicApiRequest(path: string, method: string | undefined) {
  if (method?.toUpperCase() === 'GET' && path === '/api/system/public-urls') {
    return true;
  }
  if (method?.toUpperCase() === 'POST' && path.startsWith('/api/auth/')) {
    return (
      path === '/api/auth/login' ||
      path === '/api/auth/forgot-password' ||
      path === '/api/auth/request-access'
    );
  }
  return false;
}

function notifySessionExpired(path: string, init?: RequestInit) {
  if (typeof window === 'undefined') return;
  if (!window.localStorage.getItem(TOKEN_KEY)) return;
  if (isPublicApiRequest(path, init?.method)) return;
  window.localStorage.removeItem(TOKEN_KEY);
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
}

function authHeaders(path: string, init?: RequestInit): HeadersInit {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (typeof window !== 'undefined' && !isPublicApiRequest(path, init?.method)) {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(path, init),
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const raw = (body as { error?: string }).error ?? `Request failed (${response.status})`;
    if (response.status === 401 && !isPublicApiRequest(path, init?.method)) {
      notifySessionExpired(path, init);
      throw new AuthSessionExpiredError();
    }
    throw new Error(formatApiError(raw));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getCurrentUser: () => request<CurrentUserResponse>('/api/auth/me'),
  forgotPassword: (body: { email: string }) =>
    request<{ message: string; smtpConfigured: boolean }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  requestAccess: (body: { email: string; displayName?: string; message?: string }) =>
    request<{ message: string; smtpConfigured: boolean; delivered: boolean }>(
      '/api/auth/request-access',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    ),
  updateProfile: (body: {
    email?: string;
    displayName?: string | null;
    currentPassword?: string;
    password?: string;
  }) =>
    request<CurrentUserResponse>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listApplications: () => request<Paginated<Application>>('/api/applications?pageSize=100'),
  getApplication: (id: string) => request<Application>(`/api/applications/${id}`),
  getApplicationInputs: (id: string) =>
    request<{ application: Application; items: Input[] }>(`/api/applications/${id}/inputs`),
  createApplication: (body: { name: string; appName?: string; description?: string }) =>
    request<Application>('/api/applications', { method: 'POST', body: JSON.stringify(body) }),
  updateApplication: (id: string, body: Partial<Application>) =>
    request<Application>(`/api/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteApplication: (id: string) => request<void>(`/api/applications/${id}`, { method: 'DELETE' }),

  listInputs: (applicationId?: string) => {
    const query = applicationId
      ? `?pageSize=100&applicationId=${encodeURIComponent(applicationId)}`
      : '?pageSize=100';
    return request<Paginated<Input>>(`/api/inputs${query}`);
  },
  createInput: (body: {
    applicationId: string;
    name: string;
    streamKey: string;
    ingestProtocol: Input['ingestProtocol'];
    enabled?: boolean;
    sourceRestrictions?: string[];
    protocolConfig?: Input['protocolConfig'];
    streamProfileId?: string | null;
    recordingPolicyId?: string | null;
    audioFeedProfileId?: string | null;
    streamProfileIds?: string[];
    recordingPolicyIds?: string[];
    audioFeedProfileIds?: string[];
  }) => request<Input>('/api/inputs', { method: 'POST', body: JSON.stringify(body) }),
  updateInput: (
    id: string,
    body: Omit<
      Partial<Input>,
      | 'recordingPolicyId'
      | 'streamProfileId'
      | 'audioFeedProfileId'
      | 'recordingPolicyIds'
      | 'streamProfileIds'
      | 'audioFeedProfileIds'
    > & {
      sourceRestrictions?: string[];
      protocolConfig?: Input['protocolConfig'];
      recordingPolicyId?: string | null;
      streamProfileId?: string | null;
      audioFeedProfileId?: string | null;
      recordingPolicyIds?: string[];
      streamProfileIds?: string[];
      audioFeedProfileIds?: string[];
      domainBlockId?: string | null;
    }
  ) =>
    request<Input>(`/api/inputs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteInput: (id: string) => request<void>(`/api/inputs/${id}`, { method: 'DELETE' }),
  startInputRecording: (inputId: string) =>
    request<{ recording: Record<string, unknown>; alreadyRecording: boolean }>(
      `/api/inputs/${inputId}/recording/start`,
      { method: 'POST' }
    ),
  stopInputRecording: (inputId: string) =>
    request<{ recording: Record<string, unknown> }>(`/api/inputs/${inputId}/recording/stop`, {
      method: 'POST',
    }),

  listOutputs: () => request<Paginated<Output>>('/api/outputs?pageSize=100'),
  createOutput: (body: Partial<Output>) =>
    request<Output>('/api/outputs', { method: 'POST', body: JSON.stringify(body) }),
  updateOutput: (id: string, body: Partial<Output>) =>
    request<Output>(`/api/outputs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteOutput: (id: string) => request<void>(`/api/outputs/${id}`, { method: 'DELETE' }),

  listRoutes: () => request<Paginated<Route>>('/api/routes?pageSize=100'),
  createRoute: (body: { name: string; inputId: string; outputIds: string[]; enabled?: boolean }) =>
    request<Route>('/api/routes', { method: 'POST', body: JSON.stringify(body) }),
  updateRoute: (id: string, body: Partial<Route>) =>
    request<Route>(`/api/routes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRoute: (id: string) => request<void>(`/api/routes/${id}`, { method: 'DELETE' }),

  listRestreams: () => request<{ items: RestreamGroup[] }>('/api/restreams'),
  listInputRestreams: (inputId: string) =>
    request<{ input: Input; destinations: RestreamDestination[] }>(
      `/api/restreams/inputs/${inputId}`
    ),
  createRestream: (
    inputId: string,
    body:
      | { type: 'rtmp_external'; name: string; pushUrl: string; enabled?: boolean }
      | {
          type: 'srt_external';
          name: string;
          pushUrl: string;
          srtStreamId?: string;
          passphrase?: string;
          latency?: number;
          enabled?: boolean;
        }
      | {
          type: 'rtmp_mirror';
          name: string;
          gatewayAppName: string;
          gatewayStreamName: string;
          enabled?: boolean;
        }
  ) =>
    request<RestreamDestination>(`/api/restreams/inputs/${inputId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateRestream: (destinationId: string, body: Partial<{ name: string; enabled: boolean; pushUrl: string }>) =>
    request<RestreamDestination>(`/api/restreams/${destinationId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteRestream: (destinationId: string) =>
    request<void>(`/api/restreams/${destinationId}`, { method: 'DELETE' }),
  getRestream: (destinationId: string) =>
    request<{ destination: RestreamDestination; input: Input }>(
      `/api/restreams/${destinationId}`
    ),

  listDomainBlocks: () =>
    request<Paginated<DomainBlock>>('/api/domain-blocks?pageSize=100'),
  getDomainBlock: (id: string) =>
    request<DomainBlock>(`/api/domain-blocks/${id}`),
  createDomainBlock: (body: Record<string, unknown>) =>
    request<DomainBlock>('/api/domain-blocks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateDomainBlock: (id: string, body: Record<string, unknown>) =>
    request<DomainBlock>(`/api/domain-blocks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteDomainBlock: (id: string) =>
    request<void>(`/api/domain-blocks/${id}`, { method: 'DELETE' }),

  listStorageLocations: () =>
    request<Paginated<StorageLocation>>('/api/storage-locations?pageSize=100'),
  getStorageLocation: (id: string) =>
    request<StorageLocation>(`/api/storage-locations/${id}`),
  createStorageLocation: (body: Record<string, unknown>) =>
    request<StorageLocation>('/api/storage-locations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listRecordingPolicies: (purpose: 'attach' | 'manage' = 'manage') =>
    request<Paginated<RecordingPolicy>>(
      `/api/recording-policies?pageSize=100&purpose=${purpose}`
    ),
  getRecordingPolicy: (id: string) =>
    request<RecordingPolicy>(`/api/recording-policies/${id}`),
  createRecordingPolicy: (body: {
    name: string;
    enabled?: boolean;
    storageLocationId: string;
    pathPrefix: string;
    filenameTemplate: string;
    retentionDays?: number;
    remuxToMp4?: boolean;
    keepSourceFlvHours?: number | null;
  }) =>
    request<Record<string, unknown>>('/api/recording-policies', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateRecordingPolicy: (
    id: string,
    body: Partial<{
      name: string;
      enabled: boolean;
      storageLocationId: string;
      pathPrefix: string;
      filenameTemplate: string;
      retentionDays: number | null;
      remuxToMp4: boolean;
      keepSourceFlvHours: number | null;
    }>
  ) =>
    request<RecordingPolicy>(`/api/recording-policies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteRecordingPolicy: (id: string) =>
    request<void>(`/api/recording-policies/${id}`, { method: 'DELETE' }),

  listStreamProfiles: () =>
    request<Paginated<StreamProfile>>('/api/stream-profiles?pageSize=100'),
  getStreamProfile: (id: string) => request<StreamProfile>(`/api/stream-profiles/${id}`),
  createStreamProfile: (body: {
    name: string;
    mode: 'passthrough' | 'transcode';
    renditions: Array<{
      name: string;
      videoBitrate: number;
      videoCodec: string;
      resolution: string;
      fps: number;
    }>;
    audioHandling: 'copy' | 'aac' | 'opus';
  }) =>
    request<StreamProfile>('/api/stream-profiles', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateStreamProfile: (
    id: string,
    body: Partial<{
      name: string;
      mode: 'passthrough' | 'transcode';
      renditions: Array<{
        name: string;
        videoBitrate: number;
        videoCodec: string;
        resolution: string;
        fps: number;
      }>;
      audioHandling: 'copy' | 'aac' | 'opus';
    }>
  ) =>
    request<StreamProfile>(`/api/stream-profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteStreamProfile: (id: string) =>
    request<void>(`/api/stream-profiles/${id}`, { method: 'DELETE' }),

  listAudioFeedProfiles: () =>
    request<Paginated<AudioFeedProfile>>('/api/audio-feed-profiles?pageSize=100'),
  createAudioFeedProfile: (body: {
    name: string;
    enabled?: boolean;
    outputCodecs: Array<'mp3' | 'aac' | 'opus'>;
    outputContainer: 'mp3' | 'aac' | 'ogg' | 'hls';
    storageLocationId: string;
    nameTemplate: string;
    generateDuringLive?: boolean;
  }) =>
    request<Record<string, unknown>>('/api/audio-feed-profiles', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteAudioFeedProfile: (id: string) =>
    request<void>(`/api/audio-feed-profiles/${id}`, { method: 'DELETE' }),

  listUsers: () => request<Paginated<User>>('/api/users?pageSize=100'),
  createUser: (body: {
    email: string;
    displayName?: string;
    password?: string;
    role?: User['role'];
    isActive?: boolean;
  }) =>
    request<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateUser: (
    id: string,
    body: Partial<{
      email: string;
      displayName: string | null;
      password: string;
      role: User['role'];
      isActive: boolean;
    }>
  ) =>
    request<User>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteUser: (id: string) => request<void>(`/api/users/${id}`, { method: 'DELETE' }),
  getUserAccess: (id: string) => request<UserAccessAssignment>(`/api/users/${id}/access`),
  updateUserAccess: (
    id: string,
    body: {
      applicationIds: string[];
      recordingPolicyIds?: string[];
      vodRouteIds?: string[];
      domainBlockIds?: string[];
      storageLocationIds?: string[];
    }
  ) =>
    request<UserAccess>(`/api/users/${id}/access`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listDvrWatchlist: () =>
    request<Paginated<DvrWatchlistEntry>>('/api/dvr-watchlist?pageSize=100'),
  createDvrWatchlistEntry: (body: {
    applicationName: string;
    streamPattern?: string;
    retentionHours?: number;
    storageLocationId: string;
    enabled?: boolean;
  }) =>
    request<DvrWatchlistEntry>('/api/dvr-watchlist', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateDvrWatchlistEntry: (
    id: string,
    body: Partial<{
      streamPattern: string;
      retentionHours: number;
      storageLocationId: string;
      enabled: boolean;
    }>
  ) =>
    request<DvrWatchlistEntry>(`/api/dvr-watchlist/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteDvrWatchlistEntry: (id: string) =>
    request<void>(`/api/dvr-watchlist/${id}`, { method: 'DELETE' }),

  listVodRoutes: () => request<Paginated<VodRoute>>('/api/vod-routes?pageSize=100'),
  getVodRoute: (id: string) => request<VodRoute>(`/api/vod-routes/${id}`),
  createVodRoute: (body: {
    name: string;
    enabled?: boolean;
    requestDomain?: string;
    publicPath: string;
    deliveryType: VodRoute['deliveryType'];
    sourceType: VodRoute['sourceType'];
    storageLocationId?: string;
    sourcePath: string;
    domainBlockId?: string;
    allowDirectAccess?: boolean;
    generateIframePlaylist?: boolean;
  }) =>
    request<VodRoute>('/api/vod-routes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateVodRoute: (id: string, body: Partial<VodRoute>) =>
    request<VodRoute>(`/api/vod-routes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteVodRoute: (id: string) => request<void>(`/api/vod-routes/${id}`, { method: 'DELETE' }),
  getVodRoutePlaybackInfo: (id: string) =>
    request<VodRoutePlaybackInfo>(`/api/vod-routes/${id}/playback-url`),

  listStorageObjects: (locationId: string, prefix?: string) => {
    const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
    return request<{
      prefix: string;
      bucketName: string;
      items: Array<{ key: string; type?: 'object' | 'prefix'; size: number; lastModified: string }>;
      total: number;
      truncated: boolean;
    }>(`/api/storage-locations/${locationId}/objects${qs}`);
  },
  statStorageObject: (locationId: string, objectKey: string) =>
    request<{ key: string; type: 'object'; size: number; lastModified: string; etag: string; contentType?: string }>(
      `/api/storage-locations/${locationId}/objects/${encodeURIComponent(objectKey)}/stat`
    ),
  signStorageObject: (locationId: string, objectKey: string, expirySeconds?: number) => {
    const qs = expirySeconds ? `?expirySeconds=${expirySeconds}` : '';
    return request<{ bucketName: string; objectKey: string; expirySeconds: number; url: string }>(
      `/api/storage-locations/${locationId}/objects/${encodeURIComponent(objectKey)}/signed-url${qs}`
    );
  },
  createStorageFolder: (locationId: string, prefix: string) =>
    request<{ bucketName: string; prefix: string }>(`/api/storage-locations/${locationId}/folders`, {
      method: 'POST',
      body: JSON.stringify({ prefix }),
    }),
  createStorageUploadUrl: (locationId: string, objectKey: string) =>
    request<{ bucketName: string; objectKey: string; expirySeconds: number; url: string }>(
      `/api/storage-locations/${locationId}/upload-url`,
      {
        method: 'POST',
        body: JSON.stringify({ objectKey }),
      }
    ),
  moveStorageObject: (locationId: string, objectKey: string, destinationObjectKey: string) =>
    request<{
      bucketName: string;
      sourceObjectKey: string;
      destinationObjectKey: string;
      object: { key: string; type: 'object'; size: number; lastModified: string; etag: string };
    }>(`/api/storage-locations/${locationId}/objects/${encodeURIComponent(objectKey)}/move`, {
      method: 'POST',
      body: JSON.stringify({ destinationObjectKey }),
    }),
  deleteStorageObject: (locationId: string, objectKey: string) =>
    request<void>(`/api/storage-locations/${locationId}/objects/${encodeURIComponent(objectKey)}`, {
      method: 'DELETE',
    }),
  moveStorageFolder: (locationId: string, prefix: string, destinationPrefix: string) =>
    request<{ bucketName: string; sourcePrefix: string; destinationPrefix: string; moved: number }>(
      `/api/storage-locations/${locationId}/folders/${encodeURIComponent(prefix)}/move`,
      {
        method: 'POST',
        body: JSON.stringify({ destinationPrefix }),
      }
    ),
  deleteStorageFolder: (locationId: string, prefix: string) =>
    request<{ bucketName: string; prefix: string; deleted: number }>(
      `/api/storage-locations/${locationId}/folders/${encodeURIComponent(prefix)}`,
      { method: 'DELETE' }
    ),

  listLiveSessions: (options?: { activeOnly?: boolean }) => {
    const qs = new URLSearchParams({ pageSize: '100' });
    if (options?.activeOnly) qs.set('activeOnly', 'true');
    return request<Paginated<LiveSession>>(`/api/live-sessions?${qs}`);
  },
  listInputSessions: (inputId: string) =>
    request<Paginated<LiveSession>>(`/api/inputs/${inputId}/sessions?pageSize=100`),
  getInput: (id: string) => request<Input>(`/api/inputs/${id}`),
  getInputPlaybackUrl: (
    inputId: string,
    options?: { expiresAt?: string; expiresInSeconds?: number }
  ) => {
    const params = new URLSearchParams();
    if (options?.expiresAt) params.set('expiresAt', options.expiresAt);
    if (options?.expiresInSeconds) {
      params.set('expiresInSeconds', String(options.expiresInSeconds));
    }
    const query = params.toString();
    return request<InputPlaybackShare>(
      `/api/inputs/${inputId}/playback-url${query ? `?${query}` : ''}`
    );
  },
  getLiveSessionDetail: (id: string) =>
    request<{
      session: LiveSession;
      input: Input;
      routes: Route[];
      outputs: Output[];
    }>(`/api/live-sessions/${id}`),
  listRecordings: () => request<Paginated<RecordingAsset>>('/api/recordings?pageSize=100'),
  getRecording: (id: string) => request<RecordingAsset>(`/api/recordings/${id}`),
  getRecordingPlaybackUrl: (id: string) =>
    request<RecordingPlaybackInfo>(`/api/recordings/${id}/playback-url`),
  deleteRecording: (id: string) => request<void>(`/api/recordings/${id}`, { method: 'DELETE' }),

  deleteLiveSession: (id: string) => request<void>(`/api/live-sessions/${id}`, { method: 'DELETE' }),

  issueLivePlaybackToken: (body: {
    app: string;
    stream: string;
    expiresInSeconds?: number;
  }) =>
    request<LivePlaybackInfo>('/api/playback/live-token', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  resolveLivePlayback: (params: { app: string; stream: string }) => {
    const q = new URLSearchParams({
      app: params.app,
      stream: params.stream,
    });
    return request<LivePlaybackResolve>(`/api/playback/resolve?${q.toString()}`);
  },

  getHealth: () => request<{ status: string; database: string }>('/api/health'),
  getSystemTelemetry: () => request<SystemTelemetry>('/api/system/telemetry'),
  getBandwidthHistory: (hours = 24) =>
    request<BandwidthHistoryResponse>(
      `/api/system/bandwidth-history?hours=${encodeURIComponent(String(hours))}`
    ),
  getCpuHistory: (hours = 24) =>
    request<CpuHistoryResponse>(
      `/api/system/cpu-history?hours=${encodeURIComponent(String(hours))}`
    ),
  getOperatorPublicUrls: () =>
    request<{
      rtmpIngestBase: string;
      srtIngestHost: string;
      srtIngestPort: number;
      publicAppUrl: string;
    }>('/api/system/public-urls'),
  getGatewayStatus: () =>
    request<{
      engine: string;
      synced: boolean;
      pendingReconcile?: boolean;
      ingestCount: number;
      desiredVersion: number;
      appliedVersion: number;
      configHash: string;
      error: string | null;
    }>('/api/gateway/status'),
};
