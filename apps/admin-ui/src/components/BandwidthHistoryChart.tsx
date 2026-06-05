import React from 'react';

import type { BandwidthHistorySample } from '../api/types';
import { MetricTimeSeriesChart } from './MetricTimeSeriesChart';

interface BandwidthHistoryChartProps {
  samples: BandwidthHistorySample[];
  hours: number;
  className?: string;
}

export const BandwidthHistoryChart: React.FC<BandwidthHistoryChartProps> = ({
  samples,
  hours,
  className = '',
}) => (
  <MetricTimeSeriesChart
    className={className}
    samples={samples.map((s) => ({ recordedAt: s.recordedAt, value: s.totalKbps }))}
    hours={hours}
    unit="kbps"
    ariaLabel={`Total ingest bandwidth over the last ${hours} hours`}
    emptyMessage="Collecting bandwidth samples (one point per minute). History fills over the last {hours} hours after the control API has been running."
    fillGradientId="bw-fill"
    formatHover={(point) => {
      const sample = samples.find((s) => s.recordedAt === point.recordedAt);
      return (
        <>
          {new Date(point.recordedAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' · '}
          <span className="text-slate-200">{point.value?.toLocaleString()} kbps</span>
          {sample && sample.streamCount > 0 && (
            <span> · {sample.streamCount} stream(s)</span>
          )}
        </>
      );
    }}
  />
);
