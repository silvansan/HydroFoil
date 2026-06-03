import type { StreamProfile } from '../api/types';

export type RenditionFormValues = {
  name: string;
  resolution: string;
  videoBitrate: string;
  fps: string;
};

export type StreamProfileFormValues = {
  name: string;
  mode: 'passthrough' | 'transcode';
  audioHandling: 'copy' | 'aac' | 'opus';
  renditions: RenditionFormValues[];
};

export const ABR_LADDER_FULL: RenditionFormValues[] = [
  { name: '1080p', resolution: '1920x1080', videoBitrate: '6000', fps: '30' },
  { name: '720p', resolution: '1280x720', videoBitrate: '3000', fps: '30' },
  { name: '480p', resolution: '854x480', videoBitrate: '1400', fps: '30' },
  { name: '240p', resolution: '426x240', videoBitrate: '500', fps: '30' },
];

export const ABR_LADDER_STANDARD: RenditionFormValues[] = [
  { name: '720p', resolution: '1280x720', videoBitrate: '3000', fps: '30' },
  { name: '480p', resolution: '854x480', videoBitrate: '1400', fps: '30' },
  { name: '360p', resolution: '640x360', videoBitrate: '900', fps: '30' },
];

export const AUDIO_HANDLING_OPTIONS = [
  {
    value: 'copy' as const,
    label: 'Copy source',
    description: 'Keep the ingested audio track unchanged (lowest CPU).',
  },
  {
    value: 'aac' as const,
    label: 'AAC',
    description: 'Transcode audio to AAC for broad HLS compatibility.',
  },
  {
    value: 'opus' as const,
    label: 'Opus',
    description: 'Transcode audio to Opus (often paired with WebRTC or OGG outputs).',
  },
];

export function defaultStreamProfileForm(): StreamProfileFormValues {
  return {
    name: '',
    mode: 'transcode',
    audioHandling: 'copy',
    renditions: ABR_LADDER_STANDARD.map((row) => ({ ...row })),
  };
}

export function streamProfileFromApi(profile: StreamProfile): StreamProfileFormValues {
  const renditions =
    profile.renditions && profile.renditions.length > 0
      ? profile.renditions.map((r) => ({
          name: r.name,
          resolution: r.resolution,
          videoBitrate: String(r.videoBitrate ?? ''),
          fps: String(r.fps ?? 30),
        }))
      : ABR_LADDER_STANDARD.map((row) => ({ ...row }));

  return {
    name: profile.name,
    mode: profile.mode,
    audioHandling: (profile.audioHandling as StreamProfileFormValues['audioHandling']) || 'copy',
    renditions,
  };
}

export function cloneStreamProfileForm(
  profile: StreamProfile,
  name?: string
): StreamProfileFormValues {
  const base = streamProfileFromApi(profile);
  return {
    ...base,
    name: name ?? `${profile.name} (copy)`,
  };
}

function parseResolutionHeight(resolution: string): number {
  const match = resolution.trim().match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) return 0;
  return Math.max(Number(match[1]), Number(match[2]));
}

export function sortRenditionsByHeight(renditions: RenditionFormValues[]): RenditionFormValues[] {
  return [...renditions].sort(
    (a, b) => parseResolutionHeight(b.resolution) - parseResolutionHeight(a.resolution)
  );
}

export function streamProfileFormErrors(
  form: StreamProfileFormValues
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) {
    errors.name = 'Name is required';
  }

  if (form.mode === 'transcode') {
    const valid = form.renditions.filter(
      (r) => r.name.trim() && /^\d+\s*x\s*\d+$/i.test(r.resolution.trim())
    );
    if (valid.length === 0) {
      errors.renditions = 'Add at least one rendition with resolution like 1280x720';
    }

    const names = valid.map((r) => r.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      errors.renditions = 'Rendition names must be unique';
    }
  }

  return errors;
}

export function streamProfileToApiPayload(form: StreamProfileFormValues) {
  const renditions =
    form.mode === 'transcode'
      ? sortRenditionsByHeight(form.renditions)
          .filter((rendition) => rendition.name.trim() && rendition.resolution.trim())
          .map((rendition) => ({
            name: rendition.name.trim(),
            resolution: rendition.resolution.trim(),
            videoBitrate: Number(rendition.videoBitrate) || 2500,
            videoCodec: 'h264',
            fps: Number(rendition.fps) || 30,
          }))
      : [];

  return {
    name: form.name.trim(),
    mode: form.mode,
    audioHandling: form.audioHandling,
    renditions,
  };
}

export function totalVideoBitrateKbps(
  renditions: Array<{ videoBitrate: number | string }>
): number {
  return renditions.reduce((sum, r) => sum + (Number(r.videoBitrate) || 0), 0);
}

export function describeStreamProfile(profile: Pick<
  StreamProfile,
  'mode' | 'audioHandling' | 'renditions'
>) {
  const renditions = profile.renditions ?? [];
  const ladder =
    profile.mode === 'transcode' && renditions.length > 0
      ? sortRenditionsByHeight(
          renditions.map((r) => ({
            name: r.name,
            resolution: r.resolution,
            videoBitrate: String(r.videoBitrate),
            fps: String(r.fps ?? 30),
          }))
        )
          .map((r) => r.name)
          .join(' · ')
      : null;

  const totalKbps =
    profile.mode === 'transcode' ? totalVideoBitrateKbps(renditions) : 0;

  const audio =
    AUDIO_HANDLING_OPTIONS.find((o) => o.value === profile.audioHandling)?.label ??
    profile.audioHandling;

  return {
    modeLabel: profile.mode === 'passthrough' ? 'Passthrough' : 'ABR transcode',
    audioLabel: audio,
    ladderSummary: ladder,
    totalKbps,
    renditionCount: renditions.length,
  };
}

export function formatStreamProfileOption(profile: StreamProfile): string {
  const info = describeStreamProfile(profile);
  if (profile.mode === 'passthrough') {
    return `${info.modeLabel} · ${info.audioLabel}`;
  }
  return `${info.renditionCount} renditions · ~${info.totalKbps} kbps · ${info.audioLabel}`;
}
