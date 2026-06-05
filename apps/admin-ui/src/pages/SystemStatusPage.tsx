import React from 'react';
import { PageHeader, Card, Badge } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type {
  Application,
  BandwidthHistoryResponse,
  CpuHistoryResponse,
  Input,
  LiveSession,
  SystemTelemetry,
} from '../api/types';
import { Alert } from '../components/Alert';
import { BandwidthHistoryChart } from '../components/BandwidthHistoryChart';
import { CpuHistoryChart } from '../components/CpuHistoryChart';
import { StreamMediaActions } from '../components/StreamMediaActions';
import { useStreamMonitorModal } from '../hooks/useStreamMonitorModal';
import { isAuthSessionError } from '../lib/api-error';

type WidgetVisibility = {
  cpu: boolean;
  gpu: boolean;
  streamList: boolean;
  bandwidth: boolean;
};

type DashboardState = {
  api: 'connecting' | 'ok' | 'warning' | 'error';
  database: 'connecting' | 'ok' | 'warning' | 'error';
  gateway: 'connecting' | 'ok' | 'warning' | 'error';
  ingestCount: number;
  desiredVersion: number;
  appliedVersion: number;
};

const DASHBOARD_VISIBILITY_KEY = 'hydrofoil-dashboard-visibility';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  }
  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function loadSavedVisibility(): WidgetVisibility {
  if (typeof window === 'undefined') {
    return { cpu: true, gpu: false, streamList: true, bandwidth: true };
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_VISIBILITY_KEY);
    if (!raw) {
      return { cpu: true, gpu: false, streamList: true, bandwidth: true };
    }
    return {
      cpu: true,
      gpu: false,
      streamList: true,
      bandwidth: true,
      ...(JSON.parse(raw) as Partial<WidgetVisibility>),
    };
  } catch {
    return { cpu: true, gpu: false, streamList: true, bandwidth: true };
  }
}

const SystemStatusPage: React.FC = () => {
  const { openMonitor, monitorModal } = useStreamMonitorModal();
  const [status, setStatus] = React.useState<DashboardState>({
    api: 'connecting',
    database: 'connecting',
    gateway: 'connecting',
    ingestCount: 0,
    desiredVersion: 0,
    appliedVersion: 0,
  });
  const [applications, setApplications] = React.useState<Application[]>([]);
  const [inputs, setInputs] = React.useState<Input[]>([]);
  const [sessions, setSessions] = React.useState<LiveSession[]>([]);
  const [telemetry, setTelemetry] = React.useState<SystemTelemetry | null>(null);
  const [bandwidthHistory, setBandwidthHistory] = React.useState<BandwidthHistoryResponse | null>(
    null
  );
  const [cpuHistory, setCpuHistory] = React.useState<CpuHistoryResponse | null>(null);
  const [visibility, setVisibility] = React.useState<WidgetVisibility>(loadSavedVisibility);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    window.localStorage.setItem(DASHBOARD_VISIBILITY_KEY, JSON.stringify(visibility));
  }, [visibility]);

  const loadDashboard = React.useCallback(async () => {
    const results = await Promise.allSettled([
      api.getHealth(),
      api.getGatewayStatus(),
      api.listLiveSessions({ activeOnly: true }),
      api.listInputs(),
      api.listApplications(),
      api.getSystemTelemetry(),
      api.getBandwidthHistory(24),
      api.getCpuHistory(24),
    ]);

    const [
      healthResult,
      gatewayResult,
      liveResult,
      inputResult,
      appResult,
      telemetryResult,
      bandwidthResult,
      cpuHistoryResult,
    ] = results;

    const rejections = results
      .map((result) => (result.status === 'rejected' ? result.reason : null))
      .filter((reason): reason is unknown => reason != null);

    const authFailure = rejections.some(
      (reason) => reason instanceof Error && isAuthSessionError(reason.message)
    );

    if (healthResult.status === 'fulfilled') {
      const health = healthResult.value;
      setStatus((prev) => ({
        ...prev,
        api: health.status === 'ok' ? 'ok' : 'error',
        database: health.database === 'ok' ? 'ok' : 'error',
      }));
    } else {
      setStatus((prev) => ({ ...prev, api: 'error', database: 'error' }));
    }

    if (gatewayResult.status === 'fulfilled') {
      const gateway = gatewayResult.value;
      setStatus((prev) => ({
        ...prev,
        gateway: gateway.synced ? 'ok' : gateway.pendingReconcile ? 'warning' : 'error',
        ingestCount: gateway.ingestCount,
        desiredVersion: gateway.desiredVersion,
        appliedVersion: gateway.appliedVersion,
      }));
    } else if (!authFailure) {
      setStatus((prev) => ({ ...prev, gateway: 'error' }));
    }

    if (liveResult.status === 'fulfilled') {
      setSessions(liveResult.value.items);
    }
    if (inputResult.status === 'fulfilled') {
      setInputs(inputResult.value.items);
    }
    if (appResult.status === 'fulfilled') {
      setApplications(appResult.value.items);
    }
    if (telemetryResult.status === 'fulfilled') {
      setTelemetry(telemetryResult.value);
    }
    if (bandwidthResult.status === 'fulfilled') {
      setBandwidthHistory(bandwidthResult.value);
    }
    if (cpuHistoryResult.status === 'fulfilled') {
      setCpuHistory(cpuHistoryResult.value);
    }

    if (authFailure) {
      setError('Your session has expired. Sign in again to load live streams and gateway status.');
      return;
    }

    const firstFailure = rejections[0];
    if (firstFailure) {
      setError(
        firstFailure instanceof Error ? firstFailure.message : 'Failed to load dashboard'
      );
    } else {
      setError(null);
    }
  }, []);

  React.useEffect(() => {
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  const getStatusVariant = (value: string) => {
    if (value === 'ok') return 'success';
    if (value === 'warning') return 'warning';
    if (value === 'error') return 'error';
    return 'default';
  };

  const inputById = React.useMemo(
    () => new Map(inputs.map((input) => [input.id, input])),
    [inputs]
  );
  const appById = React.useMemo(
    () => new Map(applications.map((app) => [app.id, app])),
    [applications]
  );

  const activeStreamRows = React.useMemo(() => {
    return sessions.map((session) => {
      const input = inputById.get(session.inputId);
      const app = input ? appById.get(input.applicationId) : undefined;
      return {
        id: session.id,
        streamKey: session.streamKey,
        inputName: input?.name ?? session.streamKey,
        applicationName: app?.name ?? input?.application?.name ?? 'Unknown application',
        gatewayApp: session.gatewayApp ?? input?.application?.appName ?? 'live',
        bitrateKbps: session.publisher?.bitrateKbps ?? 0,
        protocol: session.publisher?.sourceProtocol ?? input?.ingestProtocol ?? 'unknown',
        resolution: session.publisher?.resolution ?? '—',
        inputId: input?.id,
      };
    });
  }, [sessions, inputById, appById]);

  const notify = React.useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  }, []);

  const openLiveMonitor = React.useCallback(
    (row: (typeof activeStreamRows)[number]) => {
      openMonitor({
        streamKey: row.streamKey,
        gatewayApp: row.gatewayApp,
        label: row.inputName,
        status: 'publishing',
      });
    },
    [openMonitor]
  );

  const totalBitrateKbps = activeStreamRows.reduce((sum, row) => sum + row.bitrateKbps, 0);
  const activeInputs = inputs.filter((input) => input.enabled).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Quick view of control-plane health, live streams, and operator-facing stream activity"
      />

      {error && <Alert>{error}</Alert>}
      {monitorModal}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Control API</h3>
              <p className="mt-1 text-sm hf-muted">REST API and orchestration</p>
            </div>
            <Badge variant={getStatusVariant(status.api)}>{status.api.toUpperCase()}</Badge>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Database</h3>
              <p className="mt-1 text-sm hf-muted">PostgreSQL availability</p>
            </div>
            <Badge variant={getStatusVariant(status.database)}>{status.database.toUpperCase()}</Badge>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Media Engine</h3>
              <p className="mt-1 text-sm hf-muted">
                Desired {status.desiredVersion} · Applied {status.appliedVersion}
              </p>
            </div>
            <Badge variant={getStatusVariant(status.gateway)}>{status.gateway.toUpperCase()}</Badge>
          </div>
        </Card>

        <Card className="p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Live Snapshot</h3>
            <p className="mt-1 text-sm hf-muted">
              {activeStreamRows.length} live stream(s) · {totalBitrateKbps.toLocaleString()} kbps total
            </p>
            <p className="mt-3 text-xs text-slate-500">
              {activeInputs} enabled inputs · {status.ingestCount} desired ingest route(s)
            </p>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Dashboard widgets</h2>
            <p className="mt-1 text-sm hf-muted">
              Choose which quick-view panels are visible for this browser session.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            {(
              [
                ['cpu', 'CPU panel'],
                ['gpu', 'GPU panel'],
                ['streamList', 'Live stream list'],
                ['bandwidth', 'Bandwidth summary'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visibility[key]}
                  onChange={(event) =>
                    setVisibility((current) => ({ ...current, [key]: event.target.checked }))
                  }
                  className="rounded border-slate-600 text-brand-500"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <div className="space-y-6">
          {visibility.bandwidth && (
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Bandwidth</h2>
                  <p className="mt-1 text-sm hf-muted">
                    Total ingest bitrate (SRS recv) — sampled every minute, last 24 hours.
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Now:{' '}
                    <span className="font-medium text-slate-100">
                      {totalBitrateKbps.toLocaleString()} kbps
                    </span>
                    {activeStreamRows.length > 0 && (
                      <span className="hf-muted"> · {activeStreamRows.length} live stream(s)</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-5">
                <BandwidthHistoryChart
                  samples={bandwidthHistory?.samples ?? []}
                  hours={bandwidthHistory?.hours ?? 24}
                />
              </div>

              <div className="mt-8 border-t border-slate-700/50 pt-6">
                  <h3 className="text-base font-semibold text-slate-100">CPU usage</h3>
                  <p className="mt-1 text-sm hf-muted">
                    Host CPU % — sampled every minute, last 24 hours.
                  </p>
                  {telemetry && (
                    <p className="mt-2 text-sm text-slate-300">
                      Now:{' '}
                      <span className="font-medium text-slate-100">
                        {telemetry.cpu.usagePercent === null
                          ? 'Sampling…'
                          : `${telemetry.cpu.usagePercent.toFixed(1)}%`}
                      </span>
                      <span className="hf-muted">
                        {' '}
                        · load 1m {telemetry.cpu.loadAverage1m.toFixed(2)}
                      </span>
                    </p>
                  )}
                  <div className="mt-4">
                    <CpuHistoryChart
                      samples={cpuHistory?.samples ?? []}
                      hours={cpuHistory?.hours ?? 24}
                    />
                  </div>
                </div>
            </Card>
          )}

          {visibility.streamList && (
            <Card className="p-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Live now</h2>
                <p className="mt-1 text-sm hf-muted">
                  Quick operator view of which streams are currently publishing.
                </p>
              </div>
              {activeStreamRows.length === 0 ? (
                <p className="mt-6 text-sm hf-muted">No streams are live at the moment.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {activeStreamRows.map((row) => (
                    <div
                      key={row.id}
                      className="hf-live-row"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-200">{row.inputName}</p>
                          <p className="text-xs text-slate-500">
                            {row.applicationName} · {row.gatewayApp}/{row.streamKey}
                          </p>
                          <div className="mt-2 grid gap-1 sm:grid-cols-3 text-xs text-slate-400">
                            <p>Protocol: {row.protocol}</p>
                            <p>Bitrate: {row.bitrateKbps.toLocaleString()} kbps</p>
                            <p>Resolution: {row.resolution}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Badge variant="success">LIVE</Badge>
                          <StreamMediaActions
                            inputId={row.inputId}
                            target={{
                              streamKey: row.streamKey,
                              gatewayApp: row.gatewayApp,
                              label: row.inputName,
                              status: 'publishing',
                            }}
                            onPreview={() => openLiveMonitor(row)}
                            onMonitor={() => openLiveMonitor(row)}
                            onNotify={notify}
                            showLiveWebShare
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {visibility.cpu && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-100">CPU</h2>
              {telemetry ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="hf-muted">Host usage</span>
                    <span className="text-slate-200">
                      {telemetry.cpu.usagePercent === null
                        ? 'Sampling...'
                        : `${telemetry.cpu.usagePercent.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="hf-muted">CPU model</span>
                    <span className="max-w-[14rem] truncate text-slate-200" title={telemetry.cpu.model}>
                      {telemetry.cpu.model}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="hf-muted">Cores</span>
                    <span className="text-slate-200">{telemetry.cpu.coreCount}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-800/70 bg-slate-900/30 px-3 py-2">
                      <p className="text-xs hf-muted">1m load</p>
                      <p className="mt-1 text-slate-200">{telemetry.cpu.loadAverage1m.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800/70 bg-slate-900/30 px-3 py-2">
                      <p className="text-xs hf-muted">5m load</p>
                      <p className="mt-1 text-slate-200">{telemetry.cpu.loadAverage5m.toFixed(2)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800/70 bg-slate-900/30 px-3 py-2">
                      <p className="text-xs hf-muted">15m load</p>
                      <p className="mt-1 text-slate-200">{telemetry.cpu.loadAverage15m.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-700/70 px-4 py-6 text-sm hf-muted">
                  Loading CPU telemetry...
                </div>
              )}
            </Card>
          )}

          {visibility.gpu && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-slate-100">GPU</h2>
              {telemetry?.gpu.available ? (
                <div className="mt-4 space-y-3">
                  {telemetry.gpu.devices.map((device) => (
                    <div
                      key={`${device.name}-${device.driverVersion ?? 'driver'}`}
                      className="rounded-xl border border-slate-800/60 bg-slate-900/30 px-4 py-3 text-sm"
                    >
                      <p className="font-medium text-slate-200">{device.name}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <p className="hf-muted">
                          Utilization:{' '}
                          <span className="text-slate-200">
                            {device.utilizationPercent === null
                              ? 'Unknown'
                              : `${device.utilizationPercent.toFixed(1)}%`}
                          </span>
                        </p>
                        <p className="hf-muted">
                          Temperature:{' '}
                          <span className="text-slate-200">
                            {device.temperatureC === null ? 'Unknown' : `${device.temperatureC} °C`}
                          </span>
                        </p>
                        <p className="hf-muted">
                          Memory used:{' '}
                          <span className="text-slate-200">
                            {device.memoryUsedBytes === null
                              ? 'Unknown'
                              : formatBytes(device.memoryUsedBytes)}
                          </span>
                        </p>
                        <p className="hf-muted">
                          Memory total:{' '}
                          <span className="text-slate-200">
                            {device.memoryTotalBytes === null
                              ? 'Unknown'
                              : formatBytes(device.memoryTotalBytes)}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-700/70 px-4 py-6 text-sm hf-muted">
                  {telemetry?.gpu.note ?? 'Loading GPU telemetry...'}
                </div>
              )}
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-100">Operator quick view</h2>
            <div className="mt-4 space-y-3 text-sm">
              {telemetry && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="hf-muted">Host</span>
                    <span className="text-slate-200">{telemetry.host.hostname}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="hf-muted">Memory used</span>
                    <span className="text-slate-200">
                      {formatBytes(telemetry.memory.usedBytes)} / {formatBytes(telemetry.memory.totalBytes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="hf-muted">Memory usage</span>
                    <span className="text-slate-200">{telemetry.memory.usagePercent.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="hf-muted">API RSS</span>
                    <span className="text-slate-200">{formatBytes(telemetry.memory.processRssBytes)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="hf-muted">Applications</span>
                <span className="text-slate-200">{applications.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="hf-muted">Inputs</span>
                <span className="text-slate-200">{inputs.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="hf-muted">Enabled inputs</span>
                <span className="text-slate-200">{activeInputs}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="hf-muted">Active live sessions</span>
                <span className="text-slate-200">{activeStreamRows.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="hf-muted">Desired ingest routes</span>
                <span className="text-slate-200">{status.ingestCount}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SystemStatusPage;
