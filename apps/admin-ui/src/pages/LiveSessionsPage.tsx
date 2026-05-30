import React from 'react';
import { PageHeader, Card, Badge } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { LiveSession } from '../api/types';
import { Alert } from '../components/Alert';
import { ClickableRow, RowActionsCell } from '../components/ClickableRow';
import { StreamLiveBadge } from '../components/StreamLiveBadge';
import { StreamMediaActions } from '../components/StreamMediaActions';
import { useResourceList } from '../hooks/useResourceList';
import { useStreamPreviewModal } from '../hooks/useStreamPreviewModal';
import { useStreamMonitorModal } from '../hooks/useStreamMonitorModal';
import { formatBitrateKbps, formatUptime } from '../lib/format-uptime';

function streamPath(session: LiveSession): string {
  const app = session.gatewayApp ?? 'live';
  return session.publisher?.streamPath ?? `/${app}/${session.streamKey}`;
}

function cell(value: string | undefined, mono = false): React.ReactNode {
  if (!value) return <span className="text-slate-600">—</span>;
  return (
    <span className={mono ? 'font-mono text-slate-300' : 'text-slate-300'} title={value}>
      {value}
    </span>
  );
}

const LiveSessionsPage: React.FC = () => {
  const { items, isLoading, error, reload } = useResourceList<LiveSession>(() =>
    api.listLiveSessions({ activeOnly: true })
  );
  const { openPreview, previewModal } = useStreamPreviewModal();
  const { openMonitor, monitorModal } = useStreamMonitorModal();
  const [rowToast, setRowToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      reload().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [reload]);

  const rowNotify = (message: string) => {
    setRowToast(message);
    window.setTimeout(() => setRowToast(null), 2000);
  };

  return (
    <div>
      <PageHeader
        title="Live Sessions"
        description="Active publishers from SRS — stream path, encoder, codecs, and bitrate refresh every 5s"
      />

      {error && <Alert>{error}</Alert>}
      {rowToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-2 text-sm text-white shadow-lg">
          {rowToast}
        </div>
      )}

      {previewModal}
      {monitorModal}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">On air</h2>
          <Badge variant="success">{items.length} live</Badge>
        </div>
        {isLoading && items.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">Loading live streams…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted space-y-2">
            <p>Nothing live right now.</p>
            <p className="text-xs max-w-lg mx-auto">
              Publish from your encoder to a stream key on{' '}
              <a href="/inputs" className="text-brand-400 hover:underline">
                Inputs
              </a>
              . Ended sessions are kept in each key&apos;s{' '}
              <strong className="text-slate-300">Session log</strong>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[56rem]">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                    Live stream
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                    Publisher IP
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                    Protocol
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Video</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Audio</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                    Bitrate / resolution
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Uptime</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((session) => {
                  const gatewayApp = session.gatewayApp ?? 'live';
                  const pub = session.publisher;
                  const bitrate = formatBitrateKbps(pub?.bitrateKbps);
                  const uptime =
                    pub?.uptimeSeconds !== undefined
                      ? formatUptime(pub.uptimeSeconds)
                      : undefined;

                  return (
                    <ClickableRow key={session.id} to={`/stream-keys/${session.inputId}`}>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center gap-2 font-mono text-slate-200">
                          {streamPath(session)}
                          <StreamLiveBadge />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{cell(pub?.publisherIp, true)}</td>
                      <td className="px-4 py-3 text-sm">{cell(pub?.sourceProtocol)}</td>
                      <td className="px-4 py-3 text-sm max-w-[8rem] truncate">
                        {cell(pub?.videoCodec)}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-[6rem] truncate">
                        {cell(pub?.audioCodec)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {bitrate || pub?.resolution ? (
                          <div className="flex flex-col gap-0.5 text-slate-300">
                            {bitrate && <span>{bitrate}</span>}
                            {pub?.resolution && (
                              <span className="text-slate-500">{pub.resolution}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-400">
                        {cell(uptime, true)}
                      </td>
                      <RowActionsCell className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <StreamMediaActions
                            target={{
                              streamKey: session.streamKey,
                              gatewayApp,
                              label: session.streamKey,
                              status: session.status,
                            }}
                            onPreview={() =>
                              openPreview({
                                streamKey: session.streamKey,
                                gatewayApp,
                                label: session.streamKey,
                                status: session.status,
                              })
                            }
                            onMonitor={() =>
                              openMonitor({
                                streamKey: session.streamKey,
                                gatewayApp,
                                label: session.streamKey,
                                status: session.status,
                              })
                            }
                            onNotify={rowNotify}
                          />
                        </div>
                      </RowActionsCell>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default LiveSessionsPage;
