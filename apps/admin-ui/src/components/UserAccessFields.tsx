import React from 'react';

import { api } from '../api/client';
import type {
  Application,
  DomainBlock,
  RecordingPolicy,
  StorageLocation,
  UserAccessAssignment,
  VodRoute,
} from '../api/types';

type UserAccessFieldsProps = {
  userId: string | null;
  value: UserAccessAssignment;
  onChange: (next: UserAccessAssignment) => void;
  disabled?: boolean;
};

function toggleId(ids: string[], id: string, checked: boolean) {
  if (checked) return ids.includes(id) ? ids : [...ids, id];
  return ids.filter((current) => current !== id);
}

const UserAccessFields: React.FC<UserAccessFieldsProps> = ({
  userId,
  value,
  onChange,
  disabled = false,
}) => {
  const [applications, setApplications] = React.useState<Application[]>([]);
  const [policies, setPolicies] = React.useState<RecordingPolicy[]>([]);
  const [vodRoutes, setVodRoutes] = React.useState<VodRoute[]>([]);
  const [domainBlocks, setDomainBlocks] = React.useState<DomainBlock[]>([]);
  const [storageLocations, setStorageLocations] = React.useState<StorageLocation[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      api.listApplications(),
      api.listRecordingPolicies('attach'),
      api.listVodRoutes(),
      api.listDomainBlocks(),
      api.listStorageLocations(),
    ])
      .then(([appsResult, policiesResult, vodResult, blocksResult, storageResult]) => {
        if (cancelled) return;
        setApplications(appsResult.items);
        setPolicies(policiesResult.items);
        setVodRoutes(vodResult.items);
        setDomainBlocks(blocksResult.items);
        setStorageLocations(storageResult.items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    api
      .getUserAccess(userId)
      .then((access) => {
        if (!cancelled) onChange(access);
      })
      .catch(() => {
        // keep current form state
      });
    return () => {
      cancelled = true;
    };
  }, [userId, onChange]);

  if (loading) {
    return <p className="text-sm hf-muted">Loading access scopes…</p>;
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
      <div>
        <h3 className="text-sm font-medium text-slate-200">Application access</h3>
        <p className="mt-1 text-xs hf-muted">
          Moderators only see and manage stream keys under selected applications.
        </p>
        <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
          {applications.length === 0 ? (
            <p className="text-xs hf-muted">No applications yet.</p>
          ) : (
            applications.map((app) => (
              <label key={app.id} className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  className="accent-brand-400"
                  checked={value.applicationIds.includes(app.id)}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      applicationIds: toggleId(
                        value.applicationIds,
                        app.id,
                        event.target.checked
                      ),
                    })
                  }
                />
                <span>
                  {app.name}{' '}
                  <span className="text-xs hf-muted">({app.appName})</span>
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-200">Recording policies (optional)</h3>
        <p className="mt-1 text-xs hf-muted">
          Leave unchecked to allow any org policy on stream keys. When selected, the moderator can
          also create and edit those policy definitions (not only attach them).
        </p>
        <div className="mt-3 max-h-32 space-y-2 overflow-y-auto">
          {policies.map((policy) => (
            <label key={policy.id} className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                className="accent-brand-400"
                checked={value.recordingPolicyIds.includes(policy.id)}
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...value,
                    recordingPolicyIds: toggleId(
                      value.recordingPolicyIds,
                      policy.id,
                      event.target.checked
                    ),
                  })
                }
              />
              {policy.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-200">VOD routes (optional)</h3>
        <p className="mt-1 text-xs hf-muted">
          Assign routes this moderator may view and edit. Without assignments, VOD routes are hidden.
        </p>
        <div className="mt-3 max-h-32 space-y-2 overflow-y-auto">
          {vodRoutes.length === 0 ? (
            <p className="text-xs hf-muted">No VOD routes configured.</p>
          ) : (
            vodRoutes.map((route) => (
              <label key={route.id} className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  className="accent-brand-400"
                  checked={value.vodRouteIds.includes(route.id)}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      vodRouteIds: toggleId(value.vodRouteIds, route.id, event.target.checked),
                    })
                  }
                />
                {route.name}
              </label>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-200">Privacy policies (optional)</h3>
        <p className="mt-1 text-xs hf-muted">
          Assign domain-block policies this moderator may view and edit. Without assignments, Privacy
          Policies is hidden.
        </p>
        <div className="mt-3 max-h-32 space-y-2 overflow-y-auto">
          {domainBlocks.length === 0 ? (
            <p className="text-xs hf-muted">No privacy policies configured.</p>
          ) : (
            domainBlocks.map((block) => (
              <label key={block.id} className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  className="accent-brand-400"
                  checked={value.domainBlockIds.includes(block.id)}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      domainBlockIds: toggleId(value.domainBlockIds, block.id, event.target.checked),
                    })
                  }
                />
                {block.name}
              </label>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-200">Storage locations (optional)</h3>
        <p className="mt-1 text-xs hf-muted">
          Assign buckets this moderator may browse and use in recording policies. Without
          assignments, Storage is hidden.
        </p>
        <div className="mt-3 max-h-32 space-y-2 overflow-y-auto">
          {storageLocations.length === 0 ? (
            <p className="text-xs hf-muted">No storage locations configured.</p>
          ) : (
            storageLocations.map((location) => (
              <label key={location.id} className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  className="accent-brand-400"
                  checked={value.storageLocationIds.includes(location.id)}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      storageLocationIds: toggleId(
                        value.storageLocationIds,
                        location.id,
                        event.target.checked
                      ),
                    })
                  }
                />
                {location.name}
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserAccessFields;
