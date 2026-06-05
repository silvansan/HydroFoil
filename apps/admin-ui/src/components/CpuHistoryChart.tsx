import React from 'react';

import type { CpuHistorySample } from '../api/types';
import { MetricTimeSeriesChart } from './MetricTimeSeriesChart';

interface CpuHistoryChartProps {
  samples: CpuHistorySample[];
  hours: number;
  className?: string;
}

export const CpuHistoryChart: React.FC<CpuHistoryChartProps> = ({
  samples,
  hours,
  className = '',
}) => (
  <MetricTimeSeriesChart
    className={className}
    samples={samples.map((s) => ({ recordedAt: s.recordedAt, value: s.usagePercent }))}
    hours={hours}
    unit="%"
    maxValue={100}
    ariaLabel={`Host CPU usage over the last ${hours} hours`}
    emptyMessage="Collecting CPU samples (one point per minute). History fills over the last {hours} hours after the control API has been running."
    fillGradientId="cpu-fill"
    strokeColor="rgb(96 165 250)"
    fillColorTop="rgb(96 165 250)"
    fillColorBottom="rgb(96 165 250)"
    formatValue={(v) => `${Math.round(v)}`}
    formatHover={(point) => {
      const sample = samples.find((s) => s.recordedAt === point.recordedAt);
      return (
        <>
          {new Date(point.recordedAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' · '}
          <span className="text-slate-200">
            {point.value === null ? '—' : `${point.value.toFixed(1)}%`}
          </span>
          {sample && (
            <span> · load 1m: {sample.loadAverage1m.toFixed(2)}</span>
          )}
        </>
      );
    }}
  />
);
