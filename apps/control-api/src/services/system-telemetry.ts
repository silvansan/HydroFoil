import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  SystemCpuTelemetry,
  SystemGpuDeviceTelemetry,
  SystemGpuTelemetry,
  SystemMemoryTelemetry,
  SystemTelemetry,
} from '@hydrofoil/shared-types';

const execFileAsync = promisify(execFile);
const GPU_CACHE_TTL_MS = 15_000;

type CpuTimes = {
  idle: number;
  total: number;
};

type CpuSnapshot = {
  sampledAt: number;
  cores: CpuTimes[];
};

function readCpuSnapshot(): CpuSnapshot {
  return {
    sampledAt: Date.now(),
    cores: os.cpus().map((cpu) => {
      const total =
        cpu.times.user +
        cpu.times.nice +
        cpu.times.sys +
        cpu.times.irq +
        cpu.times.idle;
      return {
        idle: cpu.times.idle,
        total,
      };
    }),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeCpuUsagePercent(previous: CpuSnapshot, current: CpuSnapshot): number | null {
  if (previous.cores.length === 0 || previous.cores.length !== current.cores.length) {
    return null;
  }

  let idleDelta = 0;
  let totalDelta = 0;

  for (let index = 0; index < current.cores.length; index += 1) {
    idleDelta += current.cores[index].idle - previous.cores[index].idle;
    totalDelta += current.cores[index].total - previous.cores[index].total;
  }

  if (totalDelta <= 0) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 1000) / 10));
}

function toNullableNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function mibToBytes(value: number | null): number | null {
  return value === null ? null : Math.round(value * 1024 * 1024);
}

export class SystemTelemetryService {
  private previousCpuSnapshot: CpuSnapshot | null = null;
  private gpuCache:
    | {
        sampledAtMs: number;
        payload: SystemGpuTelemetry;
      }
    | null = null;

  async collect(): Promise<SystemTelemetry> {
    const sampledAt = new Date().toISOString();
    const cpu = await this.collectCpu(sampledAt);
    const memory = this.collectMemory(sampledAt);
    const gpu = await this.collectGpu(sampledAt);

    return {
      host: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptimeSeconds: Math.floor(os.uptime()),
      },
      cpu,
      memory,
      gpu,
    };
  }

  private async collectCpu(sampledAt: string): Promise<SystemCpuTelemetry> {
    const model = os.cpus()[0]?.model ?? 'Unknown CPU';
    const current =
      this.previousCpuSnapshot === null
        ? await (async () => {
            const first = readCpuSnapshot();
            await sleep(250);
            this.previousCpuSnapshot = first;
            return readCpuSnapshot();
          })()
        : readCpuSnapshot();

    const previous = this.previousCpuSnapshot;
    const usagePercent = previous ? computeCpuUsagePercent(previous, current) : null;
    this.previousCpuSnapshot = current;

    const [load1m, load5m, load15m] = os.loadavg();
    return {
      usagePercent,
      loadAverage1m: load1m,
      loadAverage5m: load5m,
      loadAverage15m: load15m,
      coreCount: os.cpus().length,
      model,
      sampledAt,
    };
  }

  private collectMemory(sampledAt: string): SystemMemoryTelemetry {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;

    return {
      totalBytes,
      freeBytes,
      usedBytes,
      usagePercent,
      processRssBytes: process.memoryUsage().rss,
      sampledAt,
    };
  }

  private async collectGpu(sampledAt: string): Promise<SystemGpuTelemetry> {
    if (
      this.gpuCache &&
      Date.now() - this.gpuCache.sampledAtMs < GPU_CACHE_TTL_MS
    ) {
      return {
        ...this.gpuCache.payload,
        sampledAt,
      };
    }

    try {
      const { stdout } = await execFileAsync('nvidia-smi', [
        '--query-gpu=name,utilization.gpu,memory.total,memory.used,temperature.gpu,driver_version',
        '--format=csv,noheader,nounits',
      ], {
        timeout: 4000,
        windowsHide: true,
      });

      const devices: SystemGpuDeviceTelemetry[] = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(',').map((part) => part.trim());
          const memoryTotalMib = toNullableNumber(parts[2]);
          const memoryUsedMib = toNullableNumber(parts[3]);
          const memoryUsagePercent =
            memoryTotalMib && memoryUsedMib !== null
              ? Math.round((memoryUsedMib / memoryTotalMib) * 1000) / 10
              : null;

          return {
            name: parts[0] ?? 'NVIDIA GPU',
            utilizationPercent: toNullableNumber(parts[1]),
            memoryTotalBytes: mibToBytes(memoryTotalMib),
            memoryUsedBytes: mibToBytes(memoryUsedMib),
            memoryUsagePercent,
            temperatureC: toNullableNumber(parts[4]),
            driverVersion: parts[5] || undefined,
          };
        });

      const payload: SystemGpuTelemetry = {
        available: devices.length > 0,
        vendor: devices.length > 0 ? 'nvidia' : undefined,
        devices,
        note: devices.length > 0 ? undefined : 'nvidia-smi returned no GPU devices',
        sampledAt,
      };

      this.gpuCache = { sampledAtMs: Date.now(), payload };
      return payload;
    } catch {
      const payload: SystemGpuTelemetry = {
        available: false,
        vendor: undefined,
        devices: [],
        note: 'No supported GPU telemetry source found on this host',
        sampledAt,
      };
      this.gpuCache = { sampledAtMs: Date.now(), payload };
      return payload;
    }
  }
}

export const systemTelemetryService = new SystemTelemetryService();
