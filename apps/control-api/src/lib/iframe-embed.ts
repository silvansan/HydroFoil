export interface IframeEmbedOptions {
  embedUrl: string;
  title?: string;
  width?: number | string;
  height?: number | string;
  maxWidth?: number | string;
  elementId?: string;
}

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

/** Responsive iframe embed (keep in sync with packages/player/src/embed.ts). */
export function buildIframeEmbedCode(options: IframeEmbedOptions): string {
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
