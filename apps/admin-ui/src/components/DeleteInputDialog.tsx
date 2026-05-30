import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { Button, Card } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { Input, Output, Route } from '../api/types';
import { errorMessage } from '../lib/api-error';

export type DeleteInputStrategy = 'reassign' | 'delete-routes';

export interface DeleteInputDialogProps {
  input: Input;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}

function replacementCandidates(all: Input[], target: Input): Input[] {
  const sameApp = all.filter(
    (i) => i.id !== target.id && i.applicationId === target.applicationId
  );
  if (sameApp.length > 0) return sameApp;
  return all.filter((i) => i.id !== target.id);
}

function formatRouteLabel(route: Route, outputs: Output[]): string {
  const names = route.outputIds
    .map((id) => outputs.find((o) => o.id === id)?.name)
    .filter(Boolean);
  const dest = names.length > 0 ? names.join(', ') : `${route.outputIds.length} output(s)`;
  return `${route.name} → ${dest}`;
}

export const DeleteInputDialog: React.FC<DeleteInputDialogProps> = ({
  input,
  isOpen,
  onClose,
  onDeleted,
}) => {
  const [linkedRoutes, setLinkedRoutes] = React.useState<Route[]>([]);
  const [outputs, setOutputs] = React.useState<Output[]>([]);
  const [candidates, setCandidates] = React.useState<Input[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [strategy, setStrategy] = React.useState<DeleteInputStrategy>('reassign');
  const [replacementInputId, setReplacementInputId] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [routesRes, inputsRes, outputsRes] = await Promise.all([
          api.listRoutes(),
          api.listInputs(),
          api.listOutputs(),
        ]);
        if (cancelled) return;
        const linked = routesRes.items.filter((r) => r.inputId === input.id);
        const others = replacementCandidates(inputsRes.items, input);
        setLinkedRoutes(linked);
        setOutputs(outputsRes.items);
        setCandidates(others);
        if (linked.length === 0) {
          setStrategy('delete-routes');
        } else if (others.length > 0) {
          setStrategy('reassign');
          setReplacementInputId(others[0].id);
        } else {
          setStrategy('delete-routes');
          setReplacementInputId('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, 'Failed to load routes'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, input.id, input.applicationId]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, busy, onClose]);

  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const hasRoutes = linkedRoutes.length > 0;
  const canReassign = hasRoutes && candidates.length > 0;

  const handleConfirm = async () => {
    if (busy || loading) return;
    setError(null);

    if (hasRoutes && strategy === 'reassign') {
      if (!replacementInputId) {
        setError('Choose a stream key to reassign the routes to.');
        return;
      }
    }

    setBusy(true);
    try {
      if (hasRoutes && strategy === 'reassign') {
        await Promise.all(
          linkedRoutes.map((route) =>
            api.updateRoute(route.id, { inputId: replacementInputId })
          )
        );
      } else if (hasRoutes && strategy === 'delete-routes') {
        await Promise.all(linkedRoutes.map((route) => api.deleteRoute(route.id)));
      }
      await api.deleteInput(input.id);
      await onDeleted();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete stream key'));
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const replacement = candidates.find((i) => i.id === replacementInputId);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-input-title"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <Card
        className="relative w-full max-w-lg shadow-hydro border-red-500/25 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5 space-y-4">
          <div className="flex gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-950/60 border border-red-500/35"
              aria-hidden
            >
              <AlertTriangle className="text-red-400" size={22} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 id="delete-input-title" className="text-lg font-semibold text-slate-100">
                Delete stream key?
              </h2>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Remove <span className="text-slate-200 font-medium">{input.name}</span>{' '}
                <span className="font-mono text-slate-500">({input.streamKey})</span>. This cannot
                be undone.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm hf-muted pl-[3.25rem]">Checking routes…</p>
          ) : hasRoutes ? (
            <div className="space-y-4 pl-[3.25rem]">
              <div>
                <p className="text-sm text-slate-300 font-medium mb-2">
                  {linkedRoutes.length} route{linkedRoutes.length === 1 ? '' : 's'} use this key
                </p>
                <ul className="text-sm text-slate-500 space-y-1 rounded-lg bg-slate-900/50 border border-slate-700/50 px-3 py-2">
                  {linkedRoutes.map((route) => (
                    <li key={route.id}>{formatRouteLabel(route, outputs)}</li>
                  ))}
                </ul>
              </div>

              <fieldset className="space-y-3" disabled={busy}>
                <legend className="text-sm font-medium text-slate-300 mb-1">
                  What should happen to these routes?
                </legend>

                <label
                  className={`flex gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-colors ${
                    strategy === 'reassign'
                      ? 'border-brand-500/50 bg-brand-500/10'
                      : 'border-slate-700/60 hover:border-slate-600'
                  } ${!canReassign ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="delete-input-strategy"
                    className="mt-1"
                    checked={strategy === 'reassign'}
                    disabled={!canReassign}
                    onChange={() => setStrategy('reassign')}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-200">Reassign to another stream key</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Routes keep working; only the input source changes.
                    </span>
                    {strategy === 'reassign' && canReassign && (
                      <select
                        className="hf-select mt-2 w-full text-sm"
                        value={replacementInputId}
                        onChange={(e) => setReplacementInputId(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {candidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.application?.name ?? 'App'} / {candidate.name} —{' '}
                            {candidate.streamKey}
                          </option>
                        ))}
                      </select>
                    )}
                    {!canReassign && (
                      <span className="block text-xs text-amber-400/90 mt-1">
                        No other stream keys in this application. Add one first, or delete the
                        routes below.
                      </span>
                    )}
                  </span>
                </label>

                <label
                  className={`flex gap-3 rounded-lg border px-3 py-3 cursor-pointer transition-colors ${
                    strategy === 'delete-routes'
                      ? 'border-red-500/40 bg-red-950/30'
                      : 'border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="delete-input-strategy"
                    className="mt-1"
                    checked={strategy === 'delete-routes'}
                    onChange={() => setStrategy('delete-routes')}
                  />
                  <span>
                    <span className="block text-sm text-slate-200">
                      Delete route{linkedRoutes.length === 1 ? '' : 's'} too
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {linkedRoutes.map((r) => r.name).join(', ')} will be removed.
                    </span>
                  </span>
                </label>
              </fieldset>

              {strategy === 'reassign' && replacement && (
                <p className="text-xs text-slate-500">
                  Routes will ingest from{' '}
                  <span className="font-mono text-brand-400/90">{replacement.streamKey}</span>{' '}
                  instead.
                </p>
              )}
            </div>
          ) : null}

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={busy || loading || (strategy === 'reassign' && hasRoutes && !canReassign)}
              onClick={handleConfirm}
            >
              {busy ? 'Deleting…' : 'Delete stream key'}
            </Button>
          </div>
        </div>
      </Card>
    </div>,
    document.body
  );
};
