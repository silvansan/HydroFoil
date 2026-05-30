// Domain entity definitions and validation

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Base entity schema
export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Organization
export const organizationSchema = baseEntitySchema.extend({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
});

export type Organization = z.infer<typeof organizationSchema>;

export function createOrganization(name: string, slug: string): Organization {
  return {
    id: uuidv4(),
    name,
    slug,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Input
export const applicationSchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  appName: z.string().min(1),
  description: z.string().optional(),
});

export type Application = z.infer<typeof applicationSchema>;

export const inputSchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  applicationId: z.string().uuid(),
  name: z.string().min(1),
  streamKey: z.string().min(1),
  ingestProtocol: z.enum(['rtmp', 'rtsp', 'hls', 'http']),
  enabled: z.boolean(),
  sourceRestrictions: z.string().array().optional(),
  streamProfileId: z.string().uuid().optional(),
  recordingPolicyId: z.string().uuid().optional(),
  audioFeedProfileId: z.string().uuid().optional(),
});

export type Input = z.infer<typeof inputSchema>;

// Output
export const outputSchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  routeTarget: z.string().min(1),
  playbackProtocol: z.enum(['hls', 'dash', 'rtmp', 'http-flv']),
  gatewayAppName: z.string().min(1),
  gatewayStreamName: z.string().min(1),
  domainBlockId: z.string().uuid().optional(),
  streamProfileId: z.string().uuid().optional(),
  enabled: z.boolean(),
  isPublic: z.boolean(),
});

export type Output = z.infer<typeof outputSchema>;

// Route
export const routeSchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  inputId: z.string().uuid(),
  name: z.string().min(1),
  enabled: z.boolean(),
  outputIds: z.string().uuid().array(),
  streamProfileId: z.string().uuid().optional(),
});

export type Route = z.infer<typeof routeSchema>;

// Stream Profile
export const renditionSchema = z.object({
  name: z.string(),
  videoBitrate: z.number(),
  videoCodec: z.string(),
  resolution: z.string(),
  fps: z.number(),
});

export const streamProfileSchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  mode: z.enum(['passthrough', 'transcode']),
  renditions: renditionSchema.array(),
  audioHandling: z.enum(['copy', 'aac', 'opus']),
  gatewayMapping: z.record(z.unknown()).optional(),
});

export type StreamProfile = z.infer<typeof streamProfileSchema>;

// Domain Block
export const brandingSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
});

export const domainBlockSchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  allowedDomains: z.string().array(),
  branding: brandingSchema.optional(),
  playbackAccessPolicy: z.enum(['public', 'token-required', 'restricted']),
  tokenRequired: z.boolean(),
});

export type DomainBlock = z.infer<typeof domainBlockSchema>;

// Recording Policy
export const segmentationOptionsSchema = z.object({
  segmentDurationSeconds: z.number().optional(),
  keepRaw: z.boolean(),
});

export const recordingPolicySchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  enabled: z.boolean(),
  storageLocationId: z.string().uuid(),
  pathPrefix: z.string().min(1),
  filenameTemplate: z.string().min(1),
  retentionDays: z.number().optional(),
  segmentationOptions: segmentationOptionsSchema.optional(),
  remuxToMp4: z.boolean().optional(),
  keepSourceFlvHours: z.number().int().positive().optional(),
});

export type RecordingPolicy = z.infer<typeof recordingPolicySchema>;

// Audio Feed Profile
export const audioFeedProfileSchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  enabled: z.boolean(),
  outputCodecs: z.enum(['mp3', 'aac', 'opus']).array(),
  outputContainer: z.enum(['mp3', 'aac', 'ogg', 'hls']),
  storageLocationId: z.string().uuid(),
  nameTemplate: z.string().min(1),
  generateDuringLive: z.boolean(),
});

export type AudioFeedProfile = z.infer<typeof audioFeedProfileSchema>;

// Storage Location
export const storageLocationSchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['minio', 'local', 's3']),
  bucketName: z.string().min(1),
  prefixPath: z.string(),
  isDefault: z.boolean(),
});

export type StorageLocation = z.infer<typeof storageLocationSchema>;

// Live Session
export const liveSessionSchema = baseEntitySchema.extend({
  inputId: z.string().uuid(),
  organizationId: z.string().uuid(),
  streamKey: z.string().min(1),
  status: z.enum(['publishing', 'idle', 'recording']),
  startedAt: z.date(),
  endedAt: z.date().optional(),
  bitrate: z.number().optional(),
  resolution: z.string().optional(),
  fps: z.number().optional(),
});

export type LiveSession = z.infer<typeof liveSessionSchema>;

// Recording Asset
export const recordingAssetSchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  liveSessionId: z.string().uuid(),
  recordingPolicyId: z.string().uuid(),
  status: z.enum(['recording', 'finalizing', 'ready', 'failed']),
  storageLocation: z.string().min(1),
  objectKey: z.string().min(1),
  duration: z.number(),
  fileSize: z.number(),
  startedAt: z.date(),
  finishedAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type RecordingAsset = z.infer<typeof recordingAssetSchema>;

// Generated Audio Asset
export const generatedAudioAssetSchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  recordingAssetId: z.string().uuid().optional(),
  liveSessionId: z.string().uuid().optional(),
  audioFeedProfileId: z.string().uuid(),
  codec: z.string(),
  status: z.enum(['pending', 'processing', 'ready', 'failed']),
  storageLocation: z.string().min(1),
  objectKey: z.string().min(1),
  fileSize: z.number(),
  duration: z.number(),
});

export type GeneratedAudioAsset = z.infer<typeof generatedAudioAssetSchema>;

// Job
export const jobSchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  type: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  payload: z.record(z.unknown()),
  result: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  retries: z.number(),
  maxRetries: z.number(),
  scheduledFor: z.date().optional(),
  completedAt: z.date().optional(),
});

export type Job = z.infer<typeof jobSchema>;

// Gateway Config Version
export const gatewayConfigVersionSchema = baseEntitySchema.extend({
  organizationId: z.string().uuid(),
  desiredVersion: z.number(),
  appliedVersion: z.number(),
  desiredConfig: z.record(z.unknown()),
  appliedConfig: z.record(z.unknown()).optional(),
  syncedAt: z.date().optional(),
  error: z.string().optional(),
});

export type GatewayConfigVersion = z.infer<typeof gatewayConfigVersionSchema>;
