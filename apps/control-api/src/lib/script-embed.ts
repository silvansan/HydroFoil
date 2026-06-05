const DEFAULT_HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1.6.16/dist/hls.min.js';

/** Self-contained hls.js script embed for partner pages (matches @hydrofoil/player). */
export function buildScriptEmbedCode(hlsUrl: string, title = 'HydroFoil live'): string {
  const id = 'hydrofoil-player';
  return `<!-- HydroFoil Player -->
<div id="${id}-wrap" style="width:100%;max-width:960px;background:#0a1628;border-radius:8px;overflow:hidden;border:1px solid rgba(45,212,191,0.15)">
  <div style="padding:8px 12px;font:500 13px system-ui,sans-serif;color:#e2e8f0;border-bottom:1px solid rgba(45,212,191,0.1)">${title}</div>
  <video id="${id}" controls playsinline style="width:100%;display:block;background:#000;aspect-ratio:16/9"></video>
</div>
<script src="${DEFAULT_HLS_CDN}"><\/script>
<script>
(function(){
  var v=document.getElementById(${JSON.stringify(id)});
  var src=${JSON.stringify(hlsUrl)};
  if(!v)return;
  if(v.canPlayType('application/vnd.apple.mpegurl')){v.src=src;return;}
  if(window.Hls&&Hls.isSupported()){var h=new Hls({lowLatencyMode:true});h.loadSource(src);h.attachMedia(v);}
})();
<\/script>`;
}
