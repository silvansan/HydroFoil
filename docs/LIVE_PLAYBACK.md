# Live playback model

HydroFoil separates **ingest/monitor** from **web delivery**:

| Mode | Protocol | Where | How operators use it |
|------|----------|--------|----------------------|
| **Ingest** | RTMP / SRT | SRS ingest path | OBS, vMix — `rtmp://your-host:1935/{app}/{streamKey}` |
| **Monitor** | RTMP play | Same SRS stream | VLC, vMix preview — copy **Play** URL from Preview (same URL while live) |
| **Web / embed** | HLS | Outputs, restreams, transcode renditions | Browser player, iframe embed — add an **HLS** output or restream |

Browsers cannot play RTMP. The admin **Preview** dialog does not rely on in-browser HLS/FLV for the raw ingest path.

## New inputs

Creating an input provisions an **RTMP watch** output (monitor), not HLS. Add an **Output** or **Restream** with delivery **HLS** when you need website playback.

## Transcoding

Stream profiles with transcode mode publish extra RTMP streams (`{stream}_{engine}`). Point HLS outputs or restreams at those gateway stream names for ABR web delivery.

## Environment

- `SRS_RTMP_FORWARD_BASE` — public RTMP host for publish/play URLs (e.g. `rtmp://hydrofoil.example.com:1935`)
- `PUBLIC_APP_URL` — operator UI and embed links
