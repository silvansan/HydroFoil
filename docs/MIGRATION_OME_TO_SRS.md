# OME → SRS Migration Guide

HydroFoil was initially scaffolded against **OvenMediaEngine (OME)**. The product direction is **SRS** as the runtime media engine, with HydroFoil remaining the source of truth.

## OME-specific assumptions found

| Area | OME assumption | SRS-oriented replacement |
|------|----------------|---------------------------|
| `apps/ome-adapter` | OME REST API (`/api/v1/virtualHosts`, basic auth) | `apps/srs-adapter` — SRS HTTP API (`:1985/api/v1/*`) |
| `docker-compose.yml` | `airensoft/ovenmediaengine` service | `ossrs/srs` + `config/srs/srs.conf` |
| `outputs` table / types | `ome_app_name`, `ome_stream_name` | `gateway_app_name`, `gateway_stream_name` |
| `stream_profiles` | `ome_mapping` JSONB | `gateway_mapping` (opaque adapter hints) |
| `packages/domain` | `OMEConfigGenerator`, `OMEDesiredConfig` | `SRSGatewayConfigGenerator`, `SRSDesiredConfig` |
| `packages/queue` | `RECONCILE_OME_CONFIG` | `RECONCILE_GATEWAY_CONFIG` |
| `control-api` | `GET /api/ome/status` | `GET /api/gateway/status` |
| `admin-ui` System Status | “OvenMediaEngine” label | “SRS Media Engine” |
| Docs / `.env.example` | OME URLs and passwords | `SRS_HTTP_API_URL`, `SRS_RTMP_URL` |
| `config/ome` volume mount | Referenced but missing | Removed; SRS conf under `config/srs/` |

## Architectural principle (unchanged)

- **HydroFoil owns**: inputs, outputs, routes, policies, desired gateway version, sessions, assets.
- **SRS owns**: ingest sockets, forwarding, DVR hooks, observed publish/unpublish state.
- UI and APIs use **gateway** naming (`gatewayAppName`, `gatewayStreamName`), not raw SRS config keys.

## Migration path (phases)

### Phase A — Gateway model rename (done)

1. SQL migration `002_gateway_srs_rename.sql`
2. Update `shared-types`, `entities`, `services`
3. Replace `ome-adapter` with `srs-adapter`
4. Update Compose, env, status endpoints
5. Add domain tests against SRS config generator

### Phase B — Persistence + API (next)

1. Migration runner in `packages/db`
2. control-api repositories + real CRUD
3. Emit `ConfigReconciliationRequired` on route changes
4. Seed default organization

### Phase C — SRS adapter reconciliation

1. Map `SRSDesiredConfig` → SRS vhost/app/forward/DVR fragments
2. Track `gateway_config_versions` desired vs applied
3. Webhooks: on_publish, on_unpublish, on_dvr

### Phase D — Runtime flows

1. LiveSession on publish webhook
2. Recording policy → DVR path + media-worker finalize
3. Audio feed jobs post-finalize or during live

## SRS mapping conventions (v1)

| HydroFoil field | SRS runtime |
|-----------------|-------------|
| `Input.streamKey` | RTMP publish stream name (`live/{streamKey}`) |
| `Output.gatewayAppName` | SRS app (e.g. `live`) |
| `Output.gatewayStreamName` | Playback stream name |
| `Output.routeTarget` | Operator-facing playback URL or path label |
| `SRSDesiredConfig.defaultVhost` | `__defaultVhost__` unless extended |

Forward/transcode/DVR details are applied by `srs-adapter` in a later pass; the domain layer only produces **desired** JSON.
