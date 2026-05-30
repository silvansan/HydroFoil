/** Format seconds as HH:MM:SS (e.g. live stream uptime). */
export function formatUptime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatBitrateKbps(kbps?: number): string | undefined {
  if (kbps === undefined || Number.isNaN(kbps) || kbps <= 0) return undefined;
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)}Mbps`;
  return `${kbps}Kbps`;
}
