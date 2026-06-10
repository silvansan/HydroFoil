import type {
  HydroFoilIframeEmbedOptions,
  HydroFoilScriptEmbedOptions,
  LiveEmbedPageUrlOptions,
} from './types';

const DEFAULT_HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1.6.16/dist/hls.min.js';

function cssSize(value: number | string): string {
  return typeof value === 'number' ? `${value}px` : value;
}

function defaultEmbedElementId(embedUrl: string): string {
  try {
    const url = new URL(embedUrl, 'https://hydrofoil.local');
    const app = url.searchParams.get('app') ?? 'live';
    const stream = url.searchParams.get('stream') ?? 'stream';
    const safe = `${app}-${stream}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `hydrofoil-embed-${safe}`;
  } catch {
    return `hydrofoil-embed-${Math.random().toString(36).slice(2, 9)}`;
  }
}

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

/** Responsive iframe embed pointing at a HydroFoil /embed page on your site. */
export function buildHydroFoilIframeEmbed(options: HydroFoilIframeEmbedOptions): string {
  const width = options.width ?? '100%';
  const maxWidth = options.maxWidth ?? '960px';
  const initialHeight = options.height ?? 360;
  const title = options.title ?? 'HydroFoil stream';
  const embedId = options.elementId ?? defaultEmbedElementId(options.embedUrl);
  const iframeId = `${embedId}-iframe`;

  return `<!-- HydroFoil Player (responsive iframe) -->
<div id="${embedId}" style="width:${cssSize(width)};max-width:${cssSize(maxWidth)};margin:0 auto">
  <iframe
    id="${iframeId}"
    src=${JSON.stringify(options.embedUrl)}
    title=${JSON.stringify(title)}
    style="width:100%;height:${cssSize(initialHeight)};border:0;border-radius:8px;display:block;background:transparent"
    allow="autoplay; fullscreen; picture-in-picture"
    scrolling="no"
  ></iframe>
</div>
<script>
(function(){
  var frame=document.getElementById(${JSON.stringify(iframeId)});
  if(!frame)return;
  window.addEventListener('message',function(e){
    if(!e.data||e.data.type!=='hydrofoil-embed-resize')return;
    if(e.source!==frame.contentWindow)return;
    var h=Number(e.data.height);
    if(h>0)frame.style.height=h+'px';
  });
})();
<\/script>`;
}

/** Build /embed URL query for live HLS on the same HydroFoil admin host. */
export function buildLiveEmbedPageUrl(
  streamKeyOrOptions: string | LiveEmbedPageUrlOptions,
  app = 'live',
  origin = ''
): string {
  const options =
    typeof streamKeyOrOptions === 'string'
      ? { streamKey: streamKeyOrOptions, app, origin }
      : streamKeyOrOptions;
  const params = new URLSearchParams({
    app: options.app ?? 'live',
    stream: options.streamKey,
    live: '1',
  });
  if (options.token) {
    params.set('token', options.token);
  }
  const base = (options.origin ?? '').replace(/\/$/, '');
  return `${base}/embed?${params.toString()}`;
}
