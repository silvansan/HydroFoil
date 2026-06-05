import { fetchSrsPublisherStatsByIngest } from './srs-publisher-stats';
import { systemTelemetryService } from './system-telemetry';

export interface BandwidthHistorySample {
  recordedAt: string;
  totalKbps: number;
  streamCount: number;
}

export interface CpuHistorySample {
  recordedAt: string;
  usagePercent: number | null;
  loadAverage1m: number;
}

const SAMPLE_INTERVAL_MS = 60_000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_SAMPLES = Math.ceil(MAX_AGE_MS / SAMPLE_INTERVAL_MS) + 2;

const bandwidthSamples: BandwidthHistorySample[] = [];
const cpuSamples: CpuHistorySample[] = [];
let samplerStarted = false;
let sampling = false;

function pruneSamples<T extends { recordedAt: string }>(buffer: T[]): void {
  const cutoff = Date.now() - MAX_AGE_MS;
  while (buffer.length > 0 && new Date(buffer[0].recordedAt).getTime() < cutoff) {
    buffer.shift();
  }
  while (buffer.length > MAX_SAMPLES) {
    buffer.shift();
  }
}

async function recordSample(): Promise<void> {
  if (sampling) return;
  sampling = true;
  try {
    const recordedAt = new Date().toISOString();

    const stats = await fetchSrsPublisherStatsByIngest();
    let totalKbps = 0;
    for (const entry of stats.values()) {
      totalKbps += entry.bitrateKbps ?? 0;
    }
    bandwidthSamples.push({
      recordedAt,
      totalKbps: Math.round(totalKbps),
      streamCount: stats.size,
    });

    const telemetry = await systemTelemetryService.collect();
    cpuSamples.push({
      recordedAt,
      usagePercent: telemetry.cpu.usagePercent,
      loadAverage1m: telemetry.cpu.loadAverage1m,
    });

    pruneSamples(bandwidthSamples);
    pruneSamples(cpuSamples);
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

function filterByHours<T extends { recordedAt: string }>(buffer: T[], hours: number): T[] {
  const clampedHours = Math.min(24, Math.max(1, hours));
  const cutoff = Date.now() - clampedHours * 60 * 60 * 1000;
  return buffer.filter((sample) => new Date(sample.recordedAt).getTime() >= cutoff);
}

export function getBandwidthHistory(hours = 24) {
  const clampedHours = Math.min(24, Math.max(1, hours));
  return {
    hours: clampedHours,
    intervalSeconds: SAMPLE_INTERVAL_MS / 1000,
    samples: filterByHours(bandwidthSamples, clampedHours),
  };
}

export function getCpuHistory(hours = 24) {
  const clampedHours = Math.min(24, Math.max(1, hours));
  return {
    hours: clampedHours,
    intervalSeconds: SAMPLE_INTERVAL_MS / 1000,
    samples: filterByHours(cpuSamples, clampedHours),
  };
}
