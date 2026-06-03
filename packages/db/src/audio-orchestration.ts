import { AudioFeedJobDerivation, collectAudioFeedProfileIds, PathGenerator } from '@hydrofoil/domain';
import type { GenerateAudioAssetJob } from '@hydrofoil/queue';
import type { Input, LiveSession } from '@hydrofoil/shared-types';

import type { Repositories } from './repositories';

function buildStorageLocationRef(organizationId: string, storageLocationId: string): string {
  return `location:${organizationId}:${storageLocationId}`;
}

export interface ScheduleAudioDerivativesParams {
  repos: Pick<
    Repositories,
    'generatedAudioAssets' | 'audioFeedProfiles' | 'storageLocations'
  >;
  organizationId: string;
  input: Pick<Input, 'id' | 'name' | 'organizationId' | 'streamKey' | 'audioFeedProfileId' | 'audioFeedProfileIds'>;
  session: Pick<LiveSession, 'id' | 'startedAt'>;
  trigger: 'live' | 'post-recording';
  gatewayApp: string;
  streamKey: string;
  recordingAssetId?: string;
  recordingObjectKey?: string;
  durationSec?: number;
  sessionStartedAtMs?: number;
  enqueue: (job: GenerateAudioAssetJob) => Promise<void>;
}

/** Create generated_audio_assets rows and enqueue worker jobs for an audio feed profile. */
export async function scheduleAudioDerivatives(
  params: ScheduleAudioDerivativesParams
): Promise<number> {
  const profileIds = collectAudioFeedProfileIds(params.input);
  if (profileIds.length === 0) return 0;

  const sessionStartedAtMs =
    params.sessionStartedAtMs ??
    (params.session.startedAt instanceof Date
      ? params.session.startedAt.getTime()
      : new Date(String(params.session.startedAt)).getTime());

  const derivation = new AudioFeedJobDerivation();
  const pathGenerator = new PathGenerator();
  let scheduled = 0;

  for (const profileId of profileIds) {
    const profile = await params.repos.audioFeedProfiles.findById(
      params.organizationId,
      String(profileId)
    );
    if (!profile) continue;

    if (!derivation.shouldGenerateAudio(profile as import('@hydrofoil/shared-types').AudioFeedProfile, params.trigger)) continue;

    const storage = await params.repos.storageLocations.findById(
      params.organizationId,
      String(profile.storageLocationId)
    );
    if (!storage) continue;

    const storageLocation = buildStorageLocationRef(params.organizationId, String(storage.id));
    const audioProfile = profile as import('@hydrofoil/shared-types').AudioFeedProfile;
    const jobs = derivation.deriveJobs({
      profile: audioProfile,
      session: params.session as LiveSession,
      input: params.input,
      storage: { prefixPath: String(storage.prefixPath) },
      pathGenerator,
      recordingAssetId: params.recordingAssetId,
      trigger: params.trigger,
    });

    for (const plan of jobs) {
      const { asset, created } = await params.repos.generatedAudioAssets.createOrGet({
        organizationId: params.organizationId,
        audioFeedProfileId: String(profile.id),
        codec: plan.codec,
        storageLocation,
        objectKey: plan.objectKey,
        liveSessionId: params.session.id,
        recordingAssetId: params.recordingAssetId,
        duration: params.durationSec ?? 0,
      });

      if (!created && asset.status === 'ready' && asset.fileSize > 0) {
        continue;
      }

      const shouldEnqueue =
        created || asset.status === 'pending' || asset.status === 'failed';
      if (!shouldEnqueue) {
        continue;
      }

      await params.enqueue({
        audioAssetId: String(asset.id),
        audioFeedProfileId: String(profile.id),
        organizationId: params.organizationId,
        codec: plan.codec,
        container: plan.container,
        objectKey: plan.objectKey,
        storageLocation,
        trigger: params.trigger,
        liveSessionId: params.session.id,
        recordingAssetId: params.recordingAssetId,
        gatewayApp: params.gatewayApp,
        streamKey: params.streamKey,
        recordingObjectKey: params.recordingObjectKey,
        durationSec: params.durationSec,
        sessionStartedAtMs,
      });
      scheduled += 1;
    }
  }

  return scheduled;
}
