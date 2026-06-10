import type { Input, StreamProfile } from '@hydrofoil/shared-types';

import type { AppContext } from '../context';

export interface AbrRenditionDto {
  label: string;
  height: number;
  bitrateKbps: number;
}

function parseRenditionHeight(resolution: string): number {
  const match = resolution.match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) return 0;
  return Math.max(Number(match[1]), Number(match[2]));
}

/** ABR ladder from stream profiles assigned to an input (transcode mode only). */
export async function resolveInputAbrRenditions(
  ctx: AppContext,
  input: Pick<Input, 'streamProfileId' | 'streamProfileIds'>
): Promise<AbrRenditionDto[]> {
  const profileIds = [
    ...(input.streamProfileIds ?? []),
    ...(input.streamProfileId ? [input.streamProfileId] : []),
  ];
  const seen = new Set<number>();
  const renditions: AbrRenditionDto[] = [];

  for (const profileId of profileIds) {
    const profile = (await ctx.repos.streamProfiles.findById(
      ctx.organizationId,
      profileId
    )) as StreamProfile | null;
    if (!profile || profile.mode !== 'transcode') continue;

    for (const row of profile.renditions) {
      const height = parseRenditionHeight(row.resolution);
      if (!height || seen.has(height)) continue;
      seen.add(height);
      renditions.push({
        label: row.name?.trim() || row.resolution,
        height,
        bitrateKbps: row.videoBitrate,
      });
    }
  }

  return renditions.sort((a, b) => b.height - a.height);
}
