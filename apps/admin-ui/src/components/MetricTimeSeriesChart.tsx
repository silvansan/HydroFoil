import React from 'react';

export interface MetricTimeSeriesPoint {
  recordedAt: string;
  value: number | null;
}

interface MetricTimeSeriesChartProps {
  samples: MetricTimeSeriesPoint[];
  hours: number;
  unit: string;
  ariaLabel: string;
  emptyMessage: string;
  strokeColor?: string;
  fillGradientId: string;
  fillColorTop?: string;
  fillColorBottom?: string;
  maxValue?: number;
  formatValue?: (value: number) => string;
  formatHover?: (point: MetricTimeSeriesPoint) => React.ReactNode;
  className?: string;
}

function formatTimeLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const DEFAULT_FORMAT = (value: number) => value.toLocaleString();

export const MetricTimeSeriesChart: React.FC<MetricTimeSeriesChartProps> = ({
  samples,
  hours,
  unit,
  ariaLabel,
  emptyMessage,
  strokeColor = 'rgb(45 212 191)',
  fillGradientId,
  fillColorTop = 'rgb(45 212 191)',
  fillColorBottom = 'rgb(45 212 191)',
  maxValue,
  formatValue = DEFAULT_FORMAT,
  formatHover,
  className = '',
}) => {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  const plotted = React.useMemo(
    () =>
      samples
        .filter((s) => s.value !== null && Number.isFinite(s.value))
        .map((s) => ({ recordedAt: s.recordedAt, value: s.value as number })),
    [samples]
  );

  const chart = React.useMemo(() => {
    if (plotted.length === 0) return null;

    const width = 640;
    const height = 200;
    const pad = { top: 16, right: 12, bottom: 28, left: 48 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const values = plotted.map((s) => s.value);
    const maxVal = maxValue ?? Math.max(...values, 1);
    const minTime = new Date(plotted[0].recordedAt).getTime();
    const maxTime = new Date(plotted[plotted.length - 1].recordedAt).getTime();
    const timeSpan = Math.max(maxTime - minTime, 60_000);

    const points = plotted.map((sample, index) => {
      const t = new Date(sample.recordedAt).getTime();
      const x =
        plotted.length === 1
          ? pad.left + innerW / 2
          : pad.left + ((t - minTime) / timeSpan) * innerW;
      const y = pad.top + innerH - (sample.value / maxVal) * innerH;
      return { x, y, sample, index };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${pad.top + innerH} L ${points[0].x} ${pad.top + innerH} Z`;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
      y: pad.top + innerH - frac * innerH,
      label: formatValue(maxVal * frac),
    }));

    const xLabels = [
      { t: minTime, label: formatTimeLabel(plotted[0].recordedAt) },
      {
        t: minTime + timeSpan / 2,
        label: formatTimeLabel(
          plotted[Math.floor(plotted.length / 2)]?.recordedAt ?? plotted[0].recordedAt
        ),
      },
      {
        t: maxTime,
        label: formatTimeLabel(plotted[plotted.length - 1].recordedAt),
      },
    ];

    return {
      width,
      height,
      pad,
      maxVal,
      points,
      linePath,
      areaPath,
      yTicks,
      xLabels,
      minTime,
      timeSpan,
    };
  }, [plotted, maxValue, formatValue]);

  if (!chart) {
    return (
      <p className={`text-sm hf-muted ${className}`}>
        {emptyMessage.replace('{hours}', String(hours))}
      </p>
    );
  }

  const hover = hoverIndex !== null ? chart.points[hoverIndex] : null;
  const hoverPoint: MetricTimeSeriesPoint | null = hover
    ? { recordedAt: hover.sample.recordedAt, value: hover.sample.value }
    : null;

  return (
    <div className={className}>
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="w-full min-w-[20rem] text-slate-500"
          role="img"
          aria-label={ariaLabel}
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
            <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColorTop} stopOpacity={0.35} />
              <stop offset="100%" stopColor={fillColorBottom} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <path d={chart.areaPath} fill={`url(#${fillGradientId})`} />
          <path
            d={chart.linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {chart.points.map((point) => (
            <circle
              key={point.index}
              cx={point.x}
              cy={point.y}
              r={hoverIndex === point.index ? 5 : 3}
              fill={strokeColor}
              className="cursor-crosshair"
              onMouseEnter={() => setHoverIndex(point.index)}
            />
          ))}

          {chart.xLabels.map((item, i) => {
            const x =
              chart.pad.left +
              ((item.t - chart.minTime) / chart.timeSpan) *
                (chart.width - chart.pad.left - chart.pad.right);
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
            {unit}
          </text>
        </svg>
      </div>

      {hoverPoint &&
        (formatHover ? (
          <div className="mt-2 text-xs text-slate-400">{formatHover(hoverPoint)}</div>
        ) : (
          <p className="mt-2 text-xs text-slate-400">
            {formatTimeLabel(hoverPoint.recordedAt)} ·{' '}
            <span className="text-slate-200">{formatValue(hoverPoint.value ?? 0)}</span>
          </p>
        ))}
    </div>
  );
};
