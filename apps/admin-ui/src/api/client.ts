import type {
  AudioFeedProfile,
  Application,
  DomainBlock,
  Input,
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
} from './types';
import { formatApiError } from '../lib/api-error';

const API_BASE = '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const raw = (body as { error?: string }).error ?? `Request failed (${response.status})`;
    throw new Error(formatApiError(raw));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
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
  }) => request<Input>('/api/inputs', { method: 'POST', body: JSON.stringify(body) }),
  updateInput: (
    id: string,
    body: Omit<
      Partial<Input>,
      'recordingPolicyId' | 'streamProfileId' | 'audioFeedProfileId'
    > & {
      recordingPolicyId?: string | null;
      streamProfileId?: string | null;
      audioFeedProfileId?: string | null;
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
    request<Record<string, unknown>>(`/api/domain-blocks/${id}`),
  createDomainBlock: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/domain-blocks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listStorageLocations: () =>
    request<Paginated<StorageLocation>>('/api/storage-locations?pageSize=100'),
  getStorageLocation: (id: string) =>
    request<StorageLocation>(`/api/storage-locations/${id}`),
  createStorageLocation: (body: Record<string, unknown>) =>
    request<StorageLocation>('/api/storage-locations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listRecordingPolicies: () =>
    request<Paginated<RecordingPolicy>>('/api/recording-policies?pageSize=100'),
  getRecordingPolicy: (id: string) =>
    request<Record<string, unknown>>(`/api/recording-policies/${id}`),
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
    request<Record<string, unknown>>(`/api/recording-policies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteRecordingPolicy: (id: string) =>
    request<void>(`/api/recording-policies/${id}`, { method: 'DELETE' }),

  listStreamProfiles: () =>
    request<Paginated<StreamProfile>>('/api/stream-profiles?pageSize=100'),
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
    request<Record<string, unknown>>('/api/stream-profiles', {
      method: 'POST',
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

  listLiveSessions: (options?: { activeOnly?: boolean }) => {
    const qs = new URLSearchParams({ pageSize: '100' });
    if (options?.activeOnly) qs.set('activeOnly', 'true');
    return request<Paginated<LiveSession>>(`/api/live-sessions?${qs}`);
  },
  listInputSessions: (inputId: string) =>
    request<Paginated<LiveSession>>(`/api/inputs/${inputId}/sessions?pageSize=100`),
  getInput: (id: string) => request<Input>(`/api/inputs/${id}`),
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

  getHealth: () => request<{ status: string; database: string }>('/api/health'),
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
