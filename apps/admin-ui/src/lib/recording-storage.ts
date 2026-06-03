import type { RecordingPolicy, StorageLocation } from '../api/types';

export type StorageLocationType = 'minio' | 's3' | 'local' | string;

export const FILENAME_TEMPLATE_VARS = [
  { token: '{app}', label: 'SRS app', example: 'live' },
  { token: '{streamKey}', label: 'Stream key', example: 'main' },
  { token: '{timestamp}', label: 'UTC timestamp', example: '2026-06-02T12-00-00Z' },
] as const;

export const DEFAULT_FILENAME_TEMPLATE = '{app}/{streamKey}/{timestamp}.flv';

export const STORAGE_TYPE_OPTIONS = [
  {
    value: 'minio' as const,
    label: 'Local / MinIO',
    description: 'Docker MinIO or compatible endpoint on your network.',
  },
  {
    value: 's3' as const,
    label: 'Remote S3',
    description: 'AWS, Hetzner, Wasabi, or any S3-compatible provider.',
  },
];

export function storageTypeLabel(type: string): string {
  if (type === 'minio') return 'MinIO';
  if (type === 's3') return 'S3';
  if (type === 'local') return 'Local';
  return type;
}

export function storageTypeTone(type: string): 'brand' | 'cyan' | 'neutral' {
  if (type === 's3') return 'cyan';
  if (type === 'minio') return 'brand';
  return 'neutral';
}

export function buildObjectKeyPreview(
  location: Pick<StorageLocation, 'bucketName' | 'prefixPath'> | undefined,
  pathPrefix: string,
  filenameTemplate: string
): string {
  const root = (location?.prefixPath ?? '').replace(/^\/+|\/+$/g, '');
  const sub = pathPrefix.replace(/^\/+|\/+$/g, '');
  const file = filenameTemplate.replace(/^\/+/, '') || 'recording.flv';
  const parts = [root, sub, file].filter(Boolean);
  const key = parts.join('/');
  const bucket = location?.bucketName ?? 'bucket';
  return `s3://${bucket}/${key}`;
}

export function applyFilenameTemplate(
  template: string,
  samples: { app?: string; streamKey?: string; timestamp?: string }
): string {
  return template
    .replace(/\{app\}/g, samples.app ?? 'live')
    .replace(/\{streamKey\}/g, samples.streamKey ?? 'stream')
    .replace(/\{timestamp\}/g, samples.timestamp ?? '2026-06-02T12-00-00Z');
}

export type RecordingPolicyFormValues = {
  name: string;
  storageLocationId: string;
  pathPrefix: string;
  filenameTemplate: string;
  retentionDays: string;
  remuxToMp4: boolean;
  keepSourceFlvFor24h: boolean;
  enabled: boolean;
};

export function defaultRecordingPolicyForm(
  storageLocationId = ''
): RecordingPolicyFormValues {
  return {
    name: '',
    storageLocationId,
    pathPrefix: 'dvr',
    filenameTemplate: DEFAULT_FILENAME_TEMPLATE,
    retentionDays: '',
    remuxToMp4: false,
    keepSourceFlvFor24h: true,
    enabled: true,
  };
}

export function recordingPolicyFromApi(policy: RecordingPolicy): RecordingPolicyFormValues {
  return {
    name: policy.name,
    storageLocationId: policy.storageLocationId,
    pathPrefix: policy.pathPrefix,
    filenameTemplate: policy.filenameTemplate,
    retentionDays: policy.retentionDays ? String(policy.retentionDays) : '',
    remuxToMp4: Boolean(policy.remuxToMp4),
    keepSourceFlvFor24h: (policy.keepSourceFlvHours ?? 0) > 0,
    enabled: policy.enabled,
  };
}

export function recordingPolicyFormErrors(
  values: RecordingPolicyFormValues
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = 'Policy name is required.';
  if (!values.storageLocationId) errors.storageLocationId = 'Choose a storage location.';
  if (!values.pathPrefix.trim()) errors.pathPrefix = 'Path prefix is required.';
  if (!values.filenameTemplate.trim()) errors.filenameTemplate = 'Filename template is required.';
  if (values.retentionDays.trim()) {
    const days = Number(values.retentionDays);
    if (!Number.isFinite(days) || days < 1) {
      errors.retentionDays = 'Retention must be a positive number of days.';
    }
  }
  return errors;
}

export type StorageLocationFormValues = {
  name: string;
  type: 'minio' | 's3';
  bucketName: string;
  prefixPath: string;
  endpoint: string;
  region: string;
  useSsl: boolean;
  publicEndpoint: string;
  pathStyle: boolean;
  accessKey: string;
  secretKey: string;
};

export function defaultStorageLocationForm(): StorageLocationFormValues {
  return {
    name: '',
    type: 'minio',
    bucketName: 'hydrofoil',
    prefixPath: 'media',
    endpoint: '',
    region: '',
    useSsl: true,
    publicEndpoint: '',
    pathStyle: true,
    accessKey: '',
    secretKey: '',
  };
}

export function storageLocationFormErrors(
  values: StorageLocationFormValues
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = 'Location name is required.';
  if (!values.bucketName.trim()) errors.bucketName = 'Bucket name is required.';
  if (!values.prefixPath.trim()) errors.prefixPath = 'Root prefix is required.';
  if (values.type === 's3') {
    if (!values.endpoint.trim()) errors.endpoint = 'S3 locations need an endpoint.';
    if (!values.accessKey.trim()) errors.accessKey = 'Access key is required for S3.';
    if (!values.secretKey.trim()) errors.secretKey = 'Secret key is required for S3.';
  }
  return errors;
}

export function describeFinalizeMode(policy: Pick<RecordingPolicy, 'remuxToMp4' | 'keepSourceFlvHours'>) {
  if (!policy.remuxToMp4) return { label: 'FLV only', tone: 'neutral' as const };
  if (policy.keepSourceFlvHours) {
    return { label: `MP4 + FLV ${policy.keepSourceFlvHours}h`, tone: 'brand' as const };
  }
  return { label: 'MP4 remux', tone: 'brand' as const };
}
