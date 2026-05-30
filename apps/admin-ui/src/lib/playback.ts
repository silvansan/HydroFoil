import {
  buildHydroFoilIframeEmbed,
  buildHydroFoilScriptEmbed,
  buildLiveEmbedPageUrl,
} from '@hydrofoil/player';

const PLAYBACK_BASE =
  import.meta.env.VITE_SRS_PLAYBACK_BASE?.replace(/\/$/, '') ?? '/srs-media';

const SRS_API_BASE = import.meta.env.VITE_SRS_API_BASE?.replace(/\/$/, '') ?? '/srs-api';

const INGEST_APP = 'live';

export interface PlaybackUrls {
  hls: string;
  flv: string;
  rtmp: string;
  whep: string;
}

/** Browser playback URLs (proxied via Vite in dev). */
export function playbackUrlsForIngest(streamKey: string, app = INGEST_APP): PlaybackUrls {
  const base = PLAYBACK_BASE.replace(/\/$/, '');
  return {
    hls: `${base}/${app}/${streamKey}.m3u8`,
    flv: `${base}/${app}/${streamKey}.flv`,
    rtmp: `rtmp://localhost:1935/${app}/${streamKey}`,
    whep: `${SRS_API_BASE}/rtc/v1/whep/?app=${encodeURIComponent(app)}&stream=${encodeURIComponent(streamKey)}`,
  };
}

export function playbackUrlsForOutput(app: string, stream: string): PlaybackUrls {
  return playbackUrlsForIngest(stream, app);
}

/** Absolute HLS URL for sharing / embed (uses current site origin + Vite proxy path). */
export function absoluteHlsUrl(streamKey: string, app = INGEST_APP): string {
  const { hls } = playbackUrlsForIngest(streamKey, app);
  if (hls.startsWith('http')) return hls;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${hls.startsWith('/') ? hls : `/${hls}`}`;
}

/** Absolute HTTP-FLV URL for low-latency monitor preview. */
export function absoluteFlvUrl(streamKey: string, app = INGEST_APP): string {
  const { flv } = playbackUrlsForIngest(streamKey, app);
  if (flv.startsWith('http')) return flv;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${flv.startsWith('/') ? flv : `/${flv}`}`;
}

export function buildFlvEmbedCode(flvUrl: string): string {
  return `<!-- HydroFoil recording (HTTP-FLV) -->
<video id="hydrofoil-vod" controls playsinline style="width:100%;max-width:960px;background:#000"></video>
<script src="https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.js"><\/script>
<script>
(function(){
  var v=document.getElementById('hydrofoil-vod');
  var src=${JSON.stringify(flvUrl)};
  if(!v||!window.mpegts||!mpegts.isSupported())return;
  var p=mpegts.createPlayer({type:'flv',url:src,isLive:false,hasAudio:true,hasVideo:true});
  p.attachMediaElement(v);p.load();p.play();
})();
<\/script>`;
}

/** Script embed with hls.js (paste into any site). */
export function buildHlsEmbedCode(hlsUrl: string): string {
  return buildHydroFoilScriptEmbed({ src: hlsUrl, title: 'HydroFoil live' });
}

/** iframe embed via HydroFoil /embed page (recommended for CMS / WordPress). */
export function buildLiveIframeEmbedCode(streamKey: string, app = INGEST_APP): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const embedUrl = buildLiveEmbedPageUrl(streamKey, app, origin);
  return buildHydroFoilIframeEmbed({
    embedUrl,
    title: `${app}/${streamKey}`,
  });
}

export function absoluteApiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
