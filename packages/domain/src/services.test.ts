import { describe, expect, it } from 'vitest';

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

import {
  AudioFeedJobDerivation,
  GatewayDesiredStateBuilder,
  PathGenerator,
  RecordingPolicyResolver,
  RouteResolver,
  SessionAssetAssociation,
  SRSGatewayConfigGenerator,
} from './services';

const orgId = '00000000-0000-4000-8000-000000000001';
const now = new Date('2026-05-27T12:00:00.000Z');

function baseEntity(id: string) {
  return { id, createdAt: now, updatedAt: now };
}

const defaultApplicationId = '50000000-0000-4000-8000-000000000050';

function makeInput(overrides: Partial<Input> = {}): Input {
  return {
    ...baseEntity('10000000-0000-4000-8000-000000000010'),
    organizationId: orgId,
    applicationId: defaultApplicationId,
    name: 'Main Stage',
    streamKey: 'main-stage-key',
    ingestProtocol: 'rtmp',
    enabled: true,
    application: { id: defaultApplicationId, name: 'Default', appName: 'live' },
    ...overrides,
  };
}

function makeOutput(overrides: Partial<Output> = {}): Output {
  return {
    ...baseEntity('20000000-0000-4000-8000-000000000020'),
    organizationId: orgId,
    name: 'HLS Out',
    routeTarget: '/play/main/hls',
    playbackProtocol: 'hls',
    gatewayAppName: 'live',
    gatewayStreamName: 'main-hls',
    enabled: true,
    isPublic: true,
    ...overrides,
  };
}

function makeRoute(overrides: Partial<Route> = {}): Route {
  return {
    ...baseEntity('30000000-0000-4000-8000-000000000030'),
    organizationId: orgId,
    inputId: '10000000-0000-4000-8000-000000000010',
    name: 'Main Route',
    enabled: true,
    outputIds: ['20000000-0000-4000-8000-000000000020'],
    ...overrides,
  };
}

function makeSession(overrides: Partial<LiveSession> = {}): LiveSession {
  return {
    ...baseEntity('40000000-0000-4000-8000-000000000040'),
    inputId: '10000000-0000-4000-8000-000000000010',
    organizationId: orgId,
    streamKey: 'main-stage-key',
    status: 'publishing',
    startedAt: now,
    ...overrides,
  };
}

describe('RouteResolver', () => {
  it('resolves enabled routes to enabled outputs only', () => {
    const resolver = new RouteResolver();
    const disabledOutput = makeOutput({
      id: '20000000-0000-4000-8000-000000000099',
      enabled: false,
    });
    const route = makeRoute({
      outputIds: [
        '20000000-0000-4000-8000-000000000020',
        '20000000-0000-4000-8000-000000000099',
      ],
    });

    const resolved = resolver.resolve(route, [makeOutput(), disabledOutput]);
    expect(resolved?.outputIds).toEqual(['20000000-0000-4000-8000-000000000020']);
  });

  it('returns null for disabled routes', () => {
    const resolver = new RouteResolver();
    expect(resolver.resolve(makeRoute({ enabled: false }), [makeOutput()])).toBeNull();
  });
});

describe('PathGenerator', () => {
  it('builds recording object keys from canonical templates', () => {
    const generator = new PathGenerator();
    const session = makeSession();
    const input = makeInput();
    const policy: Pick<RecordingPolicy, 'pathPrefix' | 'filenameTemplate'> = {
      pathPrefix: 'recordings/{date}/{input-name}',
      filenameTemplate: '{session-id}_{timestamp}.{ext}',
    };
    const storage: Pick<StorageLocation, 'prefixPath'> = { prefixPath: 'org/default' };

    const key = generator.generateRecordingObjectKey({
      session,
      input,
      policy,
      storage,
      extension: 'mp4',
    });

    expect(key).toContain('org/default/recordings/2026-05-27/Main-Stage');
    expect(key).toContain('40000000-0000-4000-8000-000000000040');
    expect(key.endsWith('.mp4')).toBe(true);
  });
});

describe('RecordingPolicyResolver', () => {
  it('derives recording plan with storage location and object key', () => {
    const resolver = new RecordingPolicyResolver();
    const pathGenerator = new PathGenerator();
    const policy: RecordingPolicy = {
      ...baseEntity('50000000-0000-4000-8000-000000000050'),
      organizationId: orgId,
      name: 'Default DVR',
      enabled: true,
      storageLocationId: '60000000-0000-4000-8000-000000000060',
      pathPrefix: '{date}',
      filenameTemplate: '{stream-key}.{ext}',
      retentionDays: 30,
    };
    const storage: StorageLocation = {
      ...baseEntity('60000000-0000-4000-8000-000000000060'),
      organizationId: orgId,
      name: 'Primary',
      type: 'minio',
      bucketName: 'hydrofoil',
      prefixPath: 'media',
      isDefault: true,
    };

    const plan = resolver.deriveRecordingPlan({
      input: makeInput(),
      session: makeSession(),
      policy,
      storage,
      pathGenerator,
      extension: 'mp4',
    });

    expect(plan.enabled).toBe(true);
    expect(plan.storageLocationId).toBe(storage.id);
    expect(plan.objectKey).toContain('media/');
    expect(plan.retentionDeadline).not.toBeNull();
  });
});

describe('AudioFeedJobDerivation', () => {
  it('derives post-recording audio jobs when not generating during live', () => {
    const derivation = new AudioFeedJobDerivation();
    const profile: AudioFeedProfile = {
      ...baseEntity('70000000-0000-4000-8000-000000000070'),
      organizationId: orgId,
      name: 'Podcast MP3',
      enabled: true,
      outputCodecs: ['mp3'],
      outputContainer: 'mp3',
      storageLocationId: '60000000-0000-4000-8000-000000000060',
      nameTemplate: '{input-name}_{session-id}.{ext}',
      generateDuringLive: false,
    };
    const storage: Pick<StorageLocation, 'prefixPath'> = { prefixPath: 'media' };

    const jobs = derivation.deriveJobs({
      profile,
      session: makeSession(),
      input: makeInput(),
      storage,
      pathGenerator: new PathGenerator(),
      recordingAssetId: '80000000-0000-4000-8000-000000000080',
      trigger: 'post-recording',
    });

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.codec).toBe('mp3');
    expect(jobs[0]?.trigger).toBe('post-recording');
    expect(jobs[0]?.objectKey).toContain('media/');
  });
});

describe('SRSGatewayConfigGenerator', () => {
  it('generates desired SRS ingest and forward graph from routes', () => {
    const generator = new SRSGatewayConfigGenerator();
    const input = makeInput();
    const output = makeOutput();
    const route = makeRoute();
    const domainBlock: DomainBlock = {
      ...baseEntity('90000000-0000-4000-8000-000000000090'),
      organizationId: orgId,
      name: 'Public',
      slug: 'public',
      allowedDomains: ['example.com'],
      playbackAccessPolicy: 'public',
      tokenRequired: false,
    };
    const outputWithDomain = makeOutput({
      id: '20000000-0000-4000-8000-000000000021',
      domainBlockId: domainBlock.id,
      gatewayStreamName: 'public-hls',
    });
    const routeWithDomain = makeRoute({
      id: '30000000-0000-4000-8000-000000000031',
      outputIds: [outputWithDomain.id],
    });

    const config = generator.generateDesiredConfig({
      inputs: [input],
      routes: [route, routeWithDomain],
      outputs: [output, outputWithDomain],
      streamProfiles: [],
      domainBlocks: [domainBlock],
    });

    expect(config.version).toBe(1);
    expect(config.ingests).toHaveLength(2);
    expect(config.ingests[0]?.streamKey).toBe('main-stage-key');
    expect(config.ingests[0]?.forwards[0]?.app).toBe('live');
    expect(config.ingests[0]?.forwards[0]?.stream).toBe('main-hls');
    const ingestWithDomain = config.ingests.find((ingest) =>
      ingest.forwards.some((forward) => forward.domainBlock)
    );
    expect(ingestWithDomain?.forwards[0]?.domainBlock?.slug).toBe('public');

    const hash = generator.computeConfigHash(config);
    expect(hash).toHaveLength(64);
  });

  it('does not include generatedAt in the desired config hash', () => {
    const generator = new SRSGatewayConfigGenerator();
    const base = generator.generateDesiredConfig({
      inputs: [],
      routes: [],
      outputs: [],
      streamProfiles: [],
      domainBlocks: [],
    });

    expect(
      generator.computeConfigHash({
        ...base,
        generatedAt: '2026-05-30T08:00:00.000Z',
      })
    ).toBe(
      generator.computeConfigHash({
        ...base,
        generatedAt: '2026-05-30T09:00:00.000Z',
      })
    );
  });

  it('builds via GatewayDesiredStateBuilder', () => {
    const builder = new GatewayDesiredStateBuilder();
    const config = builder.buildDesiredState({
      inputs: [makeInput()],
      routes: [makeRoute()],
      outputs: [makeOutput()],
      streamProfiles: [],
      domainBlocks: [],
    });
    expect(config.ingests).toHaveLength(1);
  });
});

describe('SessionAssetAssociation', () => {
  it('associates recording assets to sessions', () => {
    const association = new SessionAssetAssociation();
    const session = makeSession();
    const asset: Pick<RecordingAsset, 'id' | 'liveSessionId'> = {
      id: '80000000-0000-4000-8000-000000000080',
      liveSessionId: session.id,
    };

    expect(association.associateSession(session, asset)).toEqual({
      sessionId: session.id,
      assetId: asset.id,
    });
  });

  it('rejects mismatched session and asset', () => {
    const association = new SessionAssetAssociation();
    expect(() =>
      association.associateSession(makeSession(), {
        id: '80000000-0000-4000-8000-000000000080',
        liveSessionId: 'other-session',
      })
    ).toThrow(/does not belong/);
  });
});
