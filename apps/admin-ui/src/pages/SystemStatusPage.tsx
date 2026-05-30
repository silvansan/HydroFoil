import React from 'react';
import { PageHeader, Card, Badge } from '@hydrofoil/ui-kit';

import { api } from '../api/client';

const SystemStatusPage: React.FC = () => {
  const [status, setStatus] = React.useState({
    api: 'connecting',
    database: 'connecting',
    gateway: 'connecting',
    ingestCount: 0,
  });

  React.useEffect(() => {
    Promise.all([api.getHealth(), api.getGatewayStatus()])
      .then(([health, gateway]) => {
        setStatus({
          api: health.status === 'ok' ? 'ok' : 'error',
          database: health.database === 'ok' ? 'ok' : 'error',
          gateway: gateway.synced ? 'ok' : 'warning',
          ingestCount: gateway.ingestCount,
        });
      })
      .catch(() => {
        setStatus({ api: 'error', database: 'error', gateway: 'error', ingestCount: 0 });
      });
  }, []);

  const getStatusVariant = (value: string) => {
    if (value === 'ok') return 'success';
    if (value === 'warning') return 'warning';
    if (value === 'error') return 'error';
    return 'default';
  };

  return (
    <div>
      <PageHeader title="System Status" description="Monitor system health and service availability" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Control API</h3>
              <p className="text-sm text-slate-400 mt-1">REST API + Postgres</p>
            </div>
            <Badge variant={getStatusVariant(status.api)}>{status.api.toUpperCase()}</Badge>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Database</h3>
              <p className="text-sm text-gray-600 mt-1">PostgreSQL</p>
            </div>
            <Badge variant={getStatusVariant(status.database)}>{status.database.toUpperCase()}</Badge>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Media Engine</h3>
              <p className="text-sm text-gray-600 mt-1">
                SRS — {status.ingestCount} desired ingest route(s)
              </p>
            </div>
            <Badge variant={getStatusVariant(status.gateway)}>{status.gateway.toUpperCase()}</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SystemStatusPage;
