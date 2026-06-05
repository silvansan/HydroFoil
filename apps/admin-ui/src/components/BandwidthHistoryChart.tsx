import React from 'react';

import type { BandwidthHistorySample } from '../api/types';

interface BandwidthHistoryChartProps {
  samples: BandwidthHistorySample[];
  hours: number;
  className?: string;
}

function formatTimeLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export const BandwidthHistoryChart: React.FC<BandwidthHistoryChartProps> = ({
  samples,
  hours,
  className = '',
}) => {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  const chart = React.useMemo(() => {
    if (samples.length === 0) return null;

    const width = 640;
    const height = 200;
    const pad = { top: 16, right: 12, bottom: 28, left: 48 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const values = samples.map((s) => s.totalKbps);
    const maxVal = Math.max(100, ...values);
    const minTime = new Date(samples[0].recordedAt).getTime();
    const maxTime = new Date(samples[samples.length - 1].recordedAt).getTime();
    const timeSpan = Math.max(maxTime - minTime, 60_000);

    const points = samples.map((sample, index) => {
      const t = new Date(sample.recordedAt).getTime();
      const x =
        samples.length === 1
          ? pad.left + innerW / 2
          : pad.left + ((t - minTime) / timeSpan) * innerW;
      const y = pad.top + innerH - (sample.totalKbps / maxVal) * innerH;
      return { x, y, sample, index };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${pad.top + innerH} L ${points[0].x} ${pad.top + innerH} Z`;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
      y: pad.top + innerH - frac * innerH,
      label: `${Math.round(maxVal * frac).toLocaleString()}`,
    }));

    const xLabels = [
      { t: minTime, label: formatTimeLabel(samples[0].recordedAt) },
      {
        t: minTime + timeSpan / 2,
        label: formatTimeLabel(
          samples[Math.floor(samples.length / 2)]?.recordedAt ?? samples[0].recordedAt
        ),
      },
      {
        t: maxTime,
        label: formatTimeLabel(samples[samples.length - 1].recordedAt),
      },
    ];

    return { width, height, pad, innerH, maxVal, points, linePath, areaPath, yTicks, xLabels, minTime, timeSpan };
  }, [samples]);

  if (!chart) {
    return (
      <p className={`text-sm hf-muted ${className}`}>
        Collecting bandwidth samples (one point per minute). History fills over the last {hours}{' '}
        hours after the control API has been running.
      </p>
    );
  }

  const hover = hoverIndex !== null ? chart.points[hoverIndex] : null;

  return (
    <div className={className}>
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="w-full min-w-[20rem] text-slate-500"
          role="img"
          aria-label={`Total ingest bandwidth over the last ${hours} hours`}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {chart.yTicks.map((tick) => (
            <g key={tick.label}>
              <line
                x1={chart.pad.left}
                x2={chart.width - chart.pad.right}
                y1={tick.y}
                y2={tick.y}
                stroke="currentColor"
                strokeOpacity={0.15}
              />
              <text x={chart.pad.left - 8} y={tick.y + 4} textAnchor="end" fontSize={10} fill="currentColor">
                {tick.label}
              </text>
            </g>
          ))}

          <defs>
            <linearGradient id="bw-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(45 212 191)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="rgb(45 212 191)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <path d={chart.areaPath} fill="url(#bw-fill)" />
          <path
            d={chart.linePath}
            fill="none"
            stroke="rgb(45 212 191)"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {chart.points.map((point) => (
            <circle
              key={point.index}
              cx={point.x}
              cy={point.y}
              r={hoverIndex === point.index ? 5 : 3}
              fill={hoverIndex === point.index ? 'rgb(94 234 212)' : 'rgb(45 212 191)'}
              className="cursor-crosshair"
              onMouseEnter={() => setHoverIndex(point.index)}
            />
          ))}

          {chart.xLabels.map((item, i) => {
            const x =
              chart.pad.left +
              ((item.t - chart.minTime) / chart.timeSpan) * (chart.width - chart.pad.left - chart.pad.right);
            return (
              <text
                key={i}
                x={x}
                y={chart.height - 8}
                textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
                fontSize={10}
                fill="currentColor"
              >
                {item.label}
              </text>
            );
          })}

          <text x={chart.pad.left - 8} y={12} textAnchor="end" fontSize={10} fill="currentColor">
            kbps
          </text>
        </svg>
      </div>

      {hover && (
        <p className="mt-2 text-xs text-slate-400">
          {formatTimeLabel(hover.sample.recordedAt)} ·{' '}
          <span className="text-slate-200">{hover.sample.totalKbps.toLocaleString()} kbps</span>
          {hover.sample.streamCount > 0 && (
            <span> · {hover.sample.streamCount} stream(s)</span>
          )}
        </p>
      )}
    </div>
  );
};
