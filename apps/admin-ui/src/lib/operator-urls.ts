export type OperatorPublicUrls = {
  rtmpIngestBase: string;
  srtIngestHost: string;
  srtIngestPort: number;
  publicAppUrl: string;
};

let cached: OperatorPublicUrls | null = null;

export function setOperatorPublicUrls(urls: OperatorPublicUrls): void {
  cached = urls;
}

export function getOperatorPublicUrls(): OperatorPublicUrls | null {
  return cached;
}

export function rtmpIngestBase(): string {
  return (
    cached?.rtmpIngestBase ??
    import.meta.env.VITE_RTMP_INGEST_URL ??
    'rtmp://localhost:1935'
  ).replace(/\/$/, '');
}

export function srtIngestHost(): string {
  return cached?.srtIngestHost ?? import.meta.env.VITE_SRT_INGEST_HOST ?? 'localhost';
}

export function srtIngestPort(): number {
  return cached?.srtIngestPort ?? Number(import.meta.env.VITE_SRT_INGEST_PORT ?? 10080);
}

export function publicAppOrigin(): string {
  const fromApi = cached?.publicAppUrl?.replace(/\/$/, '');
  if (fromApi) return fromApi;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}
