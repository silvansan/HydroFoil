export type HydroFoilPlaybackMode = 'live-hls' | 'live-flv' | 'vod-hls';

export interface HydroFoilPlayerProps {
  /** HLS manifest or media URL */
  src: string;
  /** HTTP-FLV fallback when live HLS is unavailable (same stream, lower latency). */
  flvSrc?: string;
  /** Extra FLV URLs to try if the primary flvSrc fails (e.g. direct SRS vs /srs-media). */
  flvFallbackSrcs?: string[];
  /** Labels from assigned ABR profiles — matched to HLS levels by height. */
  renditionHints?: Array<{ label: string; height: number }>;
  /** Optional label shown in player chrome */
  title?: string;
  /** Show live badge (default true for live-hls) */
  isLive?: boolean;
  playbackMode?: HydroFoilPlaybackMode;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
}

export interface HydroFoilScriptEmbedOptions {
  src: string;
  title?: string;
  width?: string;
  maxWidth?: string;
  elementId?: string;
  /** hls.js CDN URL for script embed */
  hlsJsCdn?: string;
}

export interface HydroFoilIframeEmbedOptions {
  embedUrl: string;
  width?: number | string;
  height?: number | string;
  title?: string;
}

export interface LiveEmbedPageUrlOptions {
  streamKey: string;
  app?: string;
  origin?: string;
  token?: string;
}
