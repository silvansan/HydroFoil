import React from 'react';
import { Link } from 'react-router-dom';
import { TextInput } from '@hydrofoil/ui-kit';
import { Film, Radio } from 'lucide-react';

import type { Output, VodRoute } from '../api/types';

type PrivacyPolicyTargetPickerProps = {
  policyId: string;
  policyName: string;
  /** Resolve display name for another policy id (for reassignment hints). */
  resolveOtherPolicyName?: (policyId: string) => string | undefined;
  outputs: Output[];
  vodRoutes: VodRoute[];
  selectedOutputIds: string[];
  selectedVodRouteIds: string[];
  onToggleOutput: (outputId: string) => void;
  onToggleVodRoute: (vodRouteId: string) => void;
  onSelectAllOutputs?: () => void;
  onClearOutputs?: () => void;
  onSelectAllVod?: () => void;
  onClearVod?: () => void;
};

function matchesSearch(query: string, parts: string[]) {
  if (!query.trim()) return true;
  const needle = query.trim().toLowerCase();
  return parts.some((part) => part.toLowerCase().includes(needle));
}

type TargetRowProps = {
  checked: boolean;
  title: string;
  subtitle: string;
  conflict?: string;
  onToggle: () => void;
};

const TargetRow: React.FC<TargetRowProps> = ({ checked, title, subtitle, conflict, onToggle }) => (
  <label
    className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-sm cursor-pointer transition-colors ${
      checked
        ? 'border-brand-500/40 bg-brand-600/10 text-slate-100'
        : 'border-slate-800/80 bg-slate-900/40 text-slate-200 hover:border-slate-700'
    }`}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={onToggle}
      className="mt-0.5 rounded border-slate-600 text-brand-500"
    />
    <span className="min-w-0 flex-1">
      <span className="block font-medium">{title}</span>
      <span className="block text-xs text-slate-500">{subtitle}</span>
      {conflict && (
        <span className="mt-1 block text-xs text-amber-300/90">
          Currently on &ldquo;{conflict}&rdquo; — saving will move it here
        </span>
      )}
    </span>
  </label>
);

export const PrivacyPolicyTargetPicker: React.FC<PrivacyPolicyTargetPickerProps> = ({
  policyId,
  policyName,
  resolveOtherPolicyName,
  outputs,
  vodRoutes,
  selectedOutputIds,
  selectedVodRouteIds,
  onToggleOutput,
  onToggleVodRoute,
  onSelectAllOutputs,
  onClearOutputs,
  onSelectAllVod,
  onClearVod,
}) => {
  const [search, setSearch] = React.useState('');

  const filteredOutputs = outputs.filter((output) =>
    matchesSearch(search, [
      output.name,
      output.gatewayAppName,
      output.gatewayStreamName,
      output.playbackProtocol,
    ])
  );

  const filteredVod = vodRoutes.filter((route) =>
    matchesSearch(search, [route.name, route.publicPath, route.deliveryType])
  );

  const otherPolicyName = (attachedId: string | undefined) => {
    if (!attachedId || attachedId === policyId) return undefined;
    return resolveOtherPolicyName?.(attachedId) ?? 'another policy';
  };

  return (
    <div className="space-y-5">
      <TextInput
        label="Search targets"
        placeholder="Filter by name, path, or app…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <p className="text-xs hf-muted rounded-lg border border-slate-800/60 bg-slate-950/30 px-3 py-2">
        Checked items use <strong className="text-slate-300">{policyName}</strong> for embed and
        playback rules. Unchecked items keep their current policy (or none).
      </p>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 text-sm font-medium text-slate-300">
            <Radio size={16} className="text-brand-400" aria-hidden />
            Live stream outputs
            <span className="font-normal text-slate-500">
              ({selectedOutputIds.length}/{outputs.length})
            </span>
          </h3>
          {outputs.length > 0 && onSelectAllOutputs && onClearOutputs && (
            <div className="flex gap-2 text-xs">
              <button type="button" className="text-brand-400 hover:underline" onClick={onSelectAllOutputs}>
                Select all
              </button>
              <span className="text-slate-600">·</span>
              <button type="button" className="text-slate-400 hover:underline" onClick={onClearOutputs}>
                Clear
              </button>
            </div>
          )}
        </div>
        {outputs.length === 0 ? (
          <p className="text-sm hf-muted">
            No outputs yet.{' '}
            <Link to="/restreaming" className="text-brand-400 hover:underline">
              Add in Restreaming
            </Link>
          </p>
        ) : filteredOutputs.length === 0 ? (
          <p className="text-sm hf-muted">No outputs match your search.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {filteredOutputs.map((output) => (
              <TargetRow
                key={output.id}
                checked={selectedOutputIds.includes(output.id)}
                title={output.name}
                subtitle={`${output.gatewayAppName}/${output.gatewayStreamName} · ${output.playbackProtocol}`}
                conflict={otherPolicyName(output.domainBlockId)}
                onToggle={() => onToggleOutput(output.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 text-sm font-medium text-slate-300">
            <Film size={16} className="text-brand-400" aria-hidden />
            VOD routes
            <span className="font-normal text-slate-500">
              ({selectedVodRouteIds.length}/{vodRoutes.length})
            </span>
          </h3>
          {vodRoutes.length > 0 && onSelectAllVod && onClearVod && (
            <div className="flex gap-2 text-xs">
              <button type="button" className="text-brand-400 hover:underline" onClick={onSelectAllVod}>
                Select all
              </button>
              <span className="text-slate-600">·</span>
              <button type="button" className="text-slate-400 hover:underline" onClick={onClearVod}>
                Clear
              </button>
            </div>
          )}
        </div>
        {vodRoutes.length === 0 ? (
          <p className="text-sm hf-muted">
            No VOD routes yet.{' '}
            <Link to="/vod-routes" className="text-brand-400 hover:underline">
              Create a VOD route
            </Link>
          </p>
        ) : filteredVod.length === 0 ? (
          <p className="text-sm hf-muted">No VOD routes match your search.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {filteredVod.map((route) => (
              <TargetRow
                key={route.id}
                checked={selectedVodRouteIds.includes(route.id)}
                title={route.name}
                subtitle={`${route.publicPath} · ${route.deliveryType}`}
                conflict={otherPolicyName(route.domainBlockId)}
                onToggle={() => onToggleVodRoute(route.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrivacyPolicyTargetPicker;
