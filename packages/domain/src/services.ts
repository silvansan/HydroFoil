import { createHash } from 'node:crypto';

import type {
  AudioFeedProfile,
  DomainBlock,
  Input,
  LiveSession,
  Output,
  RecordingAsset,
  RecordingPolicy,
  Route,
  StorageLocation,
  StreamProfile,
} from '@hydrofoil/shared-types';

export interface ResolvedRoute {
  routeId: string;
  routeName: string;
  inputId: string;
  outputIds: string[];
  outputs: Output[];
  streamProfileId?: string;
}

export interface RecordingPathParams {
  session: LiveSession;
  input: Pick<Input, 'id' | 'name' | 'streamKey' | 'organizationId'>;
  policy: Pick<RecordingPolicy, 'pathPrefix' | 'filenameTemplate'>;
  storage: Pick<StorageLocation, 'prefixPath'>;
  extension?: string;
}

export interface AudioPathParams {
  session: LiveSession;
  input: Pick<Input, 'id' | 'name' | 'streamKey' | 'organizationId'>;
  storage: Pick<StorageLocation, 'prefixPath'>;
  prefix: string;
  template: string;
  codec: string;
  extension?: string;
}

export interface RecordingPlan {
  enabled: boolean;
  storageLocationId: string;
  objectKey: string;
  retentionDeadline: Date | null;
}

export interface AudioGenerationJob {
  sessionId: string;
  recordingAssetId?: string;
  codec: string;
  container: AudioFeedProfile['outputContainer'];
  objectKey: string;
  trigger: 'live' | 'post-recording';
}

/** SRS forward / playback destination derived from an Output */
export interface SRSForwardConfig {
  id: string;
  name: string;
  protocol: Output['playbackProtocol'];
  vhost: string;
  app: string;
  stream: string;
  routeTarget: string;
  isPublic: boolean;
  domainBlock?: {
    id: string;
    slug: string;
    allowedDomains: string[];
    playbackAccessPolicy: DomainBlock['playbackAccessPolicy'];
    tokenRequired: boolean;
  };
}

/** Ingest + forwards for one enabled route (maps to SRS publish + forward graph) */
export interface SRSIngestConfig {
  routeId: string;
  routeName: string;
  inputId: string;
  inputName: string;
  streamKey: string;
  enabled: boolean;
  vhost: string;
  app: string;
  profile?: {
    id: string;
    name: string;
    mode: StreamProfile['mode'];
    audioHandling: StreamProfile['audioHandling'];
    renditions: StreamProfile['renditions'];
    gatewayMapping?: StreamProfile['gatewayMapping'];
  };
  forwards: SRSForwardConfig[];
}

/** Desired gateway state consumed by srs-adapter (not raw srs.conf) */
export interface SRSDesiredConfig {
  version: 1;
  generatedAt: string;
  defaultVhost: string;
  ingests: SRSIngestConfig[];
}

export const DEFAULT_SRS_VHOST = '__defaultVhost__';
export const DEFAULT_SRS_INGEST_APP = 'live';

function normalizeSegment(segment: string | undefined): string | null {
  if (!segment) {
    return null;
  }

  const normalized = segment.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return normalized.length > 0 ? normalized : null;
}

function joinPathSegments(...segments: Array<string | undefined>): string {
  return segments
    .map(normalizeSegment)
    .filter((segment): segment is string => Boolean(segment))
    .join('/');
}

function sanitizeTemplateValue(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function renderTemplate(template: string, context: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => context[key] ?? `{${key}}`);
}

function ensureExtension(filename: string, extension?: string): string {
  if (!extension) {
    return filename;
  }

  if (filename.includes('{ext}')) {
    return filename;
  }

  if (/\.[a-z0-9]+$/i.test(filename)) {
    return filename;
  }

  return `${filename}.${extension.replace(/^\./, '')}`;
}

export class RouteResolver {
  resolve(route: Route, outputs: Output[]): ResolvedRoute | null {
    if (!route.enabled) {
      return null;
    }

    const outputIdSet = new Set(route.outputIds);
    const resolvedOutputs = outputs.filter(
      (output) => output.enabled && outputIdSet.has(output.id)
    );

    if (resolvedOutputs.length === 0) {
      return null;
    }

    return {
      routeId: route.id,
      routeName: route.name,
      inputId: route.inputId,
      outputIds: resolvedOutputs.map((output) => output.id),
      outputs: resolvedOutputs,
      streamProfileId: route.streamProfileId,
    };
  }

  resolveMany(routes: Route[], outputs: Output[]): ResolvedRoute[] {
    return routes
      .map((route) => this.resolve(route, outputs))
      .filter((route): route is ResolvedRoute => route !== null);
  }
}

export class PathGenerator {
  generateRecordingObjectKey({
    session,
    input,
    policy,
    storage,
    extension = 'mp4',
  }: RecordingPathParams): string {
    const timestamp = String(session.startedAt.getTime());
    const context = {
      'date': formatDate(session.startedAt),
      'ext': extension.replace(/^\./, ''),
      'input-id': sanitizeTemplateValue(input.id),
      'input-name': sanitizeTemplateValue(input.name),
      'organization-id': sanitizeTemplateValue(input.organizationId),
      'session-id': sanitizeTemplateValue(session.id),
      'stream-key': sanitizeTemplateValue(input.streamKey),
      'timestamp': timestamp,
    };

    const renderedPrefix = renderTemplate(policy.pathPrefix, context);
    const renderedFilename = ensureExtension(
      renderTemplate(policy.filenameTemplate, context),
      context.ext
    );

    return joinPathSegments(storage.prefixPath, renderedPrefix, renderedFilename);
  }

  generateAudioObjectKey({
    session,
    input,
    storage,
    prefix,
    template,
    codec,
    extension,
  }: AudioPathParams): string {
    const ext = extension ?? codec;
    const context = {
      'codec': sanitizeTemplateValue(codec),
      'date': formatDate(session.startedAt),
      'ext': ext.replace(/^\./, ''),
      'input-id': sanitizeTemplateValue(input.id),
      'input-name': sanitizeTemplateValue(input.name),
      'organization-id': sanitizeTemplateValue(input.organizationId),
      'session-id': sanitizeTemplateValue(session.id),
      'stream-key': sanitizeTemplateValue(input.streamKey),
      'timestamp': String(session.startedAt.getTime()),
    };

    const renderedPrefix = renderTemplate(prefix, context);
    const renderedFilename = ensureExtension(renderTemplate(template, context), context.ext);

    return joinPathSegments(storage.prefixPath, renderedPrefix, renderedFilename);
  }
}

export class RecordingPolicyResolver {
  shouldRecord(input: Pick<Input, 'enabled'>, policy: RecordingPolicy | null): boolean {
    return Boolean(policy?.enabled && input.enabled);
  }

  getRetentionDeadline(policy: RecordingPolicy, createdAt: Date): Date | null {
    if (policy.retentionDays === undefined) {
      return null;
    }

    const deadline = new Date(createdAt);
    deadline.setUTCDate(deadline.getUTCDate() + policy.retentionDays);
    return deadline;
  }

  deriveRecordingPlan(params: {
    input: Pick<Input, 'enabled' | 'id' | 'name' | 'organizationId' | 'streamKey'>;
    session: LiveSession;
    policy: RecordingPolicy;
    storage: Pick<StorageLocation, 'id' | 'prefixPath'>;
    pathGenerator: PathGenerator;
    extension?: string;
  }): RecordingPlan {
    const { input, session, policy, storage, pathGenerator, extension } = params;

    if (!this.shouldRecord(input, policy)) {
      throw new Error('Recording plan cannot be derived for a disabled input or policy.');
    }

    return {
      enabled: true,
      storageLocationId: storage.id,
      objectKey: pathGenerator.generateRecordingObjectKey({
        session,
        input,
        policy,
        storage,
        extension,
      }),
      retentionDeadline: this.getRetentionDeadline(policy, session.startedAt),
    };
  }
}

export class AudioFeedJobDerivation {
  shouldGenerateAudio(profile: AudioFeedProfile | null, trigger: 'live' | 'post-recording'): boolean {
    if (!profile?.enabled) {
      return false;
    }

    return trigger === 'live' ? profile.generateDuringLive : !profile.generateDuringLive;
  }

  deriveJobs(params: {
    profile: AudioFeedProfile;
    session: LiveSession;
    input: Pick<Input, 'id' | 'name' | 'organizationId' | 'streamKey'>;
    storage: Pick<StorageLocation, 'prefixPath'>;
    pathGenerator: PathGenerator;
    recordingAssetId?: string;
    trigger: 'live' | 'post-recording';
  }): AudioGenerationJob[] {
    const { profile, session, input, storage, pathGenerator, recordingAssetId, trigger } = params;

    if (!this.shouldGenerateAudio(profile, trigger)) {
      return [];
    }

    return profile.outputCodecs.map((codec) => ({
      sessionId: session.id,
      recordingAssetId,
      codec,
      container: profile.outputContainer,
      objectKey: pathGenerator.generateAudioObjectKey({
        session,
        input,
        storage,
        prefix: '{date}/audio/{input-name}',
        template: profile.nameTemplate,
        codec,
        extension: codec,
      }),
      trigger,
    }));
  }
}

export class SRSGatewayConfigGenerator {
  generateDesiredConfig(params: {
    inputs: Input[];
    routes: Route[];
    outputs: Output[];
    streamProfiles: StreamProfile[];
    domainBlocks: DomainBlock[];
    defaultVhost?: string;
    defaultIngestApp?: string;
  }): SRSDesiredConfig {
    const {
      inputs,
      routes,
      outputs,
      streamProfiles,
      domainBlocks,
      defaultVhost = DEFAULT_SRS_VHOST,
      defaultIngestApp = DEFAULT_SRS_INGEST_APP,
    } = params;
    const routeResolver = new RouteResolver();

    const inputById = new Map(inputs.map((input) => [input.id, input]));
    const profileById = new Map(streamProfiles.map((profile) => [profile.id, profile]));
    const domainBlockById = new Map(domainBlocks.map((block) => [block.id, block]));

    const ingests = routeResolver
      .resolveMany(routes, outputs)
      .map((resolvedRoute) => {
        const input = inputById.get(resolvedRoute.inputId);
        if (!input || !input.enabled) {
          return null;
        }

        const profileId = resolvedRoute.streamProfileId ?? resolvedRoute.outputs[0]?.streamProfileId;
        const profile = profileId ? profileById.get(profileId) : undefined;

        return {
          routeId: resolvedRoute.routeId,
          routeName: resolvedRoute.routeName,
          inputId: input.id,
          inputName: input.name,
          streamKey: input.streamKey,
          enabled: true,
          vhost: defaultVhost,
          app: input.application?.appName ?? defaultIngestApp,
          profile: profile
            ? {
                id: profile.id,
                name: profile.name,
                mode: profile.mode,
                audioHandling: profile.audioHandling,
                renditions: profile.renditions,
                gatewayMapping: profile.gatewayMapping,
              }
            : undefined,
          forwards: resolvedRoute.outputs.map((output) => {
            const domainBlock = output.domainBlockId
              ? domainBlockById.get(output.domainBlockId)
              : undefined;

            return {
              id: output.id,
              name: output.name,
              protocol: output.playbackProtocol,
              vhost: defaultVhost,
              app: output.gatewayAppName,
              stream: output.gatewayStreamName,
              routeTarget: output.routeTarget,
              isPublic: output.isPublic,
              domainBlock: domainBlock
                ? {
                    id: domainBlock.id,
                    slug: domainBlock.slug,
                    allowedDomains: domainBlock.allowedDomains,
                    playbackAccessPolicy: domainBlock.playbackAccessPolicy,
                    tokenRequired: domainBlock.tokenRequired,
                  }
                : undefined,
            };
          }),
        } as SRSIngestConfig;
      })
      .filter((ingest): ingest is SRSIngestConfig => ingest !== null);

    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      defaultVhost,
      ingests,
    };
  }

  computeConfigHash(config: SRSDesiredConfig): string {
    const { generatedAt: _generatedAt, ...stableConfig } = config;
    return createHash('sha256').update(JSON.stringify(stableConfig)).digest('hex');
  }
}

export class SessionAssetAssociation {
  associateSession(session: LiveSession, asset: Pick<RecordingAsset, 'id' | 'liveSessionId'>): {
    sessionId: string;
    assetId: string;
  } {
    if (asset.liveSessionId !== session.id) {
      throw new Error('Recording asset does not belong to the provided live session.');
    }

    return {
      sessionId: session.id,
      assetId: asset.id,
    };
  }

  canCreateRecording(
    session: Pick<LiveSession, 'status'>,
    policy: Pick<RecordingPolicy, 'enabled' | 'storageLocationId'>
  ): boolean {
    return session.status === 'publishing' && policy.enabled && policy.storageLocationId.length > 0;
  }
}

export class GatewayDesiredStateBuilder {
  private readonly configGenerator = new SRSGatewayConfigGenerator();

  buildDesiredState(params: {
    inputs: Input[];
    routes: Route[];
    outputs: Output[];
    streamProfiles: StreamProfile[];
    domainBlocks: DomainBlock[];
    defaultVhost?: string;
    defaultIngestApp?: string;
  }): SRSDesiredConfig {
    return this.configGenerator.generateDesiredConfig(params);
  }
}

/** @deprecated Use SRSGatewayConfigGenerator */
export const OMEConfigGenerator = SRSGatewayConfigGenerator;
/** @deprecated Use GatewayDesiredStateBuilder */
export const OMEDesiredStateBuilder = GatewayDesiredStateBuilder;
