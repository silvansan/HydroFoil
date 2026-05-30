import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { api } from '../api/client';

/**
 * Legacy route — redirects to stream key settings (input-centric).
 */
const LiveSessionDetailPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [inputId, setInputId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sessionId) return;
    api
      .getLiveSessionDetail(sessionId)
      .then((data) => setInputId(data.input.id))
      .catch((err) => setError(err instanceof Error ? err.message : 'Session not found'));
  }, [sessionId]);

  if (inputId) {
    return <Navigate to={`/stream-keys/${inputId}`} replace />;
  }

  if (error) {
    return <div className="hf-muted py-12 text-center">{error}</div>;
  }

  return <div className="hf-muted py-12 text-center">Loading…</div>;
};

export default LiveSessionDetailPage;
