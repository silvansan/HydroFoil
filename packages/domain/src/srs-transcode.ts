import type { Rendition, StreamProfile } from '@hydrofoil/shared-types';

export interface SrsTranscodeEngine {
  name: string;
  enabled: boolean;
  vcodec: string;
  vbitrate: number;
  vfps: number;
  vwidth: number;
  vheight: number;
  acodec: string;
  output: string;
}

function parseResolution(resolution: string): { width: number; height: number } {
  const match = resolution.match(/^(\d+)x(\d+)$/i);
  if (!match) return { width: 1280, height: 720 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

function audioCodecForProfile(profile: StreamProfile): string {
  switch (profile.audioHandling) {
    case 'aac':
      return 'aac';
    case 'opus':
      return 'libopus';
    default:
      return 'copy';
  }
}

/** Build SRS transcode engine definitions from a stream profile (for gatewayMapping or srs.conf). */
export function buildTranscodeGatewayMapping(profile: StreamProfile): Record<string, unknown> {
  if (profile.mode !== 'transcode' || profile.renditions.length === 0) {
    return profile.gatewayMapping ?? {};
  }

  const engines: SrsTranscodeEngine[] = profile.renditions.map((rendition: Rendition) => {
    const { width, height } = parseResolution(rendition.resolution);
    const engineName = rendition.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    return {
      name: engineName,
      enabled: true,
      vcodec: rendition.videoCodec.includes('264') ? 'libx264' : rendition.videoCodec,
      vbitrate: rendition.videoBitrate,
      vfps: rendition.fps,
      vwidth: width,
      vheight: height,
      acodec: audioCodecForProfile(profile),
      output: 'rtmp://127.0.0.1:[port]/[app]?vhost=[vhost]/[stream]_[engine]',
    };
  });

  return {
    srsTranscode: {
      enabled: true,
      engines,
    },
    ...(profile.gatewayMapping ?? {}),
  };
}

/** Count ingests that require SRS transcode in desired gateway config. */
export function countTranscodeIngests(
  ingests: Array<{ profile?: { mode?: string; renditions?: unknown[] } }>
): number {
  return ingests.filter(
    (ingest) => ingest.profile?.mode === 'transcode' && (ingest.profile.renditions?.length ?? 0) > 0
  ).length;
}
