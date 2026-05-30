import type { HydroFoilIframeEmbedOptions, HydroFoilScriptEmbedOptions } from './types';

const DEFAULT_HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1.6.16/dist/hls.min.js';

/** Self-contained script embed (paste into any HTML page). */
export function buildHydroFoilScriptEmbed(options: HydroFoilScriptEmbedOptions): string {
  const id = options.elementId ?? 'hydrofoil-player';
  const width = options.width ?? '100%';
  const maxWidth = options.maxWidth ?? '960px';
  const cdn = options.hlsJsCdn ?? DEFAULT_HLS_CDN;
  const title = options.title ?? 'HydroFoil live';

  return `<!-- HydroFoil Player -->
<div id="${id}-wrap" style="width:${width};max-width:${maxWidth};background:#0a1628;border-radius:8px;overflow:hidden;border:1px solid rgba(45,212,191,0.15)">
  <div style="padding:8px 12px;font:500 13px system-ui,sans-serif;color:#e2e8f0;border-bottom:1px solid rgba(45,212,191,0.1)">${title}</div>
  <video id="${id}" controls playsinline style="width:100%;display:block;background:#000;aspect-ratio:16/9"></video>
</div>
<script src="${cdn}"><\/script>
<script>
(function(){
  var v=document.getElementById(${JSON.stringify(id)});
  var src=${JSON.stringify(options.src)};
  if(!v)return;
  if(v.canPlayType('application/vnd.apple.mpegurl')){v.src=src;return;}
  if(window.Hls&&Hls.isSupported()){var h=new Hls({lowLatencyMode:true});h.loadSource(src);h.attachMedia(v);}
})();
<\/script>`;
}

/** iframe embed pointing at a HydroFoil /embed page on your site. */
export function buildHydroFoilIframeEmbed(options: HydroFoilIframeEmbedOptions): string {
  const width = options.width ?? 960;
  const height = options.height ?? 540;
  const title = options.title ?? 'HydroFoil stream';

  return `<!-- HydroFoil Player (iframe) -->
<iframe
  src=${JSON.stringify(options.embedUrl)}
  title=${JSON.stringify(title)}
  width="${width}"
  height="${height}"
  style="border:0;border-radius:8px;background:#000;max-width:100%"
  allow="autoplay; fullscreen; picture-in-picture"
  allowfullscreen
></iframe>`;
}

/** Build /embed URL query for live HLS on the same HydroFoil admin host. */
export function buildLiveEmbedPageUrl(
  streamKey: string,
  app = 'live',
  origin = ''
): string {
  const params = new URLSearchParams({
    app,
    stream: streamKey,
    live: '1',
  });
  const base = origin.replace(/\/$/, '');
  return `${base}/embed?${params.toString()}`;
}
