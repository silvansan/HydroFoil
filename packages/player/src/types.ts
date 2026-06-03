export type HydroFoilPlaybackMode = 'live-hls' | 'vod-hls';

export interface HydroFoilPlayerProps {
  /** HLS manifest or media URL */
  src: string;
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
