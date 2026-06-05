import { fetchSrsPublisherStatsByIngest } from './srs-publisher-stats';

export interface BandwidthHistorySample {
  recordedAt: string;
  totalKbps: number;
  streamCount: number;
}

const SAMPLE_INTERVAL_MS = 60_000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_SAMPLES = Math.ceil(MAX_AGE_MS / SAMPLE_INTERVAL_MS) + 2;

const samples: BandwidthHistorySample[] = [];
let samplerStarted = false;
let sampling = false;

async function recordSample(): Promise<void> {
  if (sampling) return;
  sampling = true;
  try {
    const stats = await fetchSrsPublisherStatsByIngest();
    let totalKbps = 0;
    for (const entry of stats.values()) {
      totalKbps += entry.bitrateKbps ?? 0;
    }
    const recordedAt = new Date().toISOString();
    samples.push({
      recordedAt,
      totalKbps: Math.round(totalKbps),
      streamCount: stats.size,
    });

    const cutoff = Date.now() - MAX_AGE_MS;
    while (samples.length > 0 && new Date(samples[0].recordedAt).getTime() < cutoff) {
      samples.shift();
    }
    while (samples.length > MAX_SAMPLES) {
      samples.shift();
    }
  } finally {
    sampling = false;
  }
}

export function startBandwidthHistorySampler(): void {
  if (samplerStarted) return;
  samplerStarted = true;
  void recordSample();
  setInterval(() => void recordSample(), SAMPLE_INTERVAL_MS).unref?.();
}

export function getBandwidthHistory(hours = 24): {
  hours: number;
  intervalSeconds: number;
  samples: BandwidthHistorySample[];
} {
  const clampedHours = Math.min(24, Math.max(1, hours));
  const cutoff = Date.now() - clampedHours * 60 * 60 * 1000;
  const filtered = samples.filter((sample) => new Date(sample.recordedAt).getTime() >= cutoff);
  return {
    hours: clampedHours,
    intervalSeconds: SAMPLE_INTERVAL_MS / 1000,
    samples: filtered,
  };
}
