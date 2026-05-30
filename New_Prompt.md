You are working on the HydroFoil project.

HydroFoil is a clean, operator-friendly live media control plane built on top of SRS open-source media server. It is not a generic CMS. It manages inputs, outputs, routes, policies, sessions, recordings, storage paths, gateway desired state, and media workflows. SRS remains the media runtime.

Your task is to update the project vision and architecture so HydroFoil becomes plugin-compatible in a secure, future-proof way.

Read the existing ARCHITECTURE.md first and preserve its core principles:
- Postgres is the single source of truth.
- HydroFoil owns desired media state.
- SRS is only the runtime/gateway layer.
- The SRS adapter reconciles desired config into SRS.
- Media workers run async, idempotent jobs.
- Storage paths are canonical.
- UI should remain operator-focused, not generic CRUD.
- Raw SRS configuration should not leak into the UI.

Now update ARCHITECTURE.md to introduce the following vision:

HydroFoil should be split conceptually into:

1. HydroFoil Core
   The stable trusted control plane:
   - Organizations
   - Users/roles/permissions
   - Inputs
   - Outputs
   - Routes
   - Storage locations
   - Live sessions
   - Recording assets
   - Generated media assets
   - Gateway desired state
   - Event bus
   - Job queue
   - Plugin registry
   - Plugin permission/capability system
   - SRS adapter API
   - Storage abstraction
   - Audit logs

2. HydroFoil Plugins
   Optional feature modules that add media-server capabilities without making Core bloated.

Examples:
   - hydrofoil-dvr
   - hydrofoil-cloud
   - hydrofoil-republisher
   - hydrofoil-remote-recorder
   - hydrofoil-audio-generator
   - hydrofoil-drm
   - hydrofoil-analytics
   - hydrofoil-alerts
   - hydrofoil-wordpress
   - hydrofoil-dnn
   - hydrofoil-transcoder

Important security rule:
Plugins must not directly access:
   - SRS admin API
   - raw SRS config files
   - .env secrets
   - unrestricted database access
   - Docker socket
   - host filesystem
   - arbitrary network targets

Instead, plugins must interact through safe Core capabilities.

Define a capability-based plugin API such as:

- streams.read
- streams.write
- routes.read
- routes.write
- recordings.read
- recordings.write
- recordings.delete
- storage.read
- storage.write
- storage.signedUrl
- storage.upload
- gateway.reconcile
- gateway.publishControl
- republish.manage
- drm.manage
- analytics.read
- jobs.enqueue
- events.subscribe
- settings.read
- settings.write

A plugin should declare a manifest like:

{
  "id": "hydrofoil-dvr",
  "name": "HydroFoil DVR",
  "version": "0.1.0",
  "type": "official",
  "capabilities": [
    "recordings.read",
    "recordings.write",
    "storage.write",
    "events.subscribe",
    "jobs.enqueue"
  ],
  "ui": {
    "sidebarItems": [
      {
        "label": "DVR",
        "path": "/plugins/dvr"
      }
    ]
  },
  "events": [
    "stream.started",
    "stream.stopped",
    "recording.created",
    "recording.finalized"
  ],
  "jobs": [
    "finalize-recording",
    "delete-asset"
  ]
}

But do not implement unsafe marketplace behavior yet.

For v1, the plugin model should be:
- Official plugins only
- Installed from the repository/monorepo
- Enabled/disabled by database and/or environment variable
- No arbitrary plugin upload from the UI
- No remote plugin marketplace
- No user-supplied executable code

Add a new section to ARCHITECTURE.md called “Plugin Architecture”.

It should explain:

1. Plugin Registry
   Core stores installed/enabled plugin metadata.
   Suggested DB table:
   - plugins
   - plugin_settings
   - plugin_capability_grants
   - plugin_audit_log

2. Plugin Runtime
   For v1, plugins are first-party packages inside the monorepo.
   They can register:
   - API routes under /api/plugins/:pluginId/*
   - UI sidebar items
   - settings schemas
   - event handlers
   - background job handlers
   - dashboard cards
   - stream actions
   - recording actions

3. Plugin Boundaries
   Plugins call Core services, not SRS directly.
   Example:
   plugin -> Core Gateway Service -> SRS Adapter -> SRS

   Bad:
   plugin -> SRS HTTP API directly

4. Event System
   Add domain events as first-class architecture:
   - input.created
   - output.created
   - route.created
   - route.enabled
   - route.disabled
   - gateway.reconciliation.required
   - stream.started
   - stream.stopped
   - recording.started
   - recording.created
   - recording.finalized
   - recording.failed
   - asset.created
   - asset.deleted
   - storage.object.created
   - storage.object.deleted
   - republish.started
   - republish.stopped
   - drm.asset.packaging.requested
   - drm.asset.packaged
   - audio.asset.generation.requested
   - audio.asset.generated

5. Job System
   Media work should happen in workers, not inside the request/response API path.
   Add/expand job types:
   - reconcile-gateway-config
   - finalize-recording
   - remote-recording-start
   - remote-recording-stop
   - remote-recording-finalize
   - republish-start
   - republish-stop
   - generate-mp3
   - generate-aac
   - generate-opus
   - extract-metadata
   - create-thumbnails
   - package-drm
   - upload-to-cloud
   - delete-asset
   - enforce-retention

6. Feature Plugins

Describe these future plugins:

A. HydroFoil DVR
   Purpose:
   - Local recording
   - Recording policies
   - Segmented recording
   - Retention
   - Recording finalization
   - Playback URL generation

   Uses:
   - recording policies
   - storage locations
   - media worker
   - SRS DVR hooks/webhooks

B. HydroFoil Cloud
   Purpose:
   - Upload finalized recordings/assets to S3-compatible storage
   - Support MinIO, Hetzner Object Storage, Backblaze, AWS S3
   - Optional delete-local-after-upload policy
   - Remote playback URL or signed URL

C. HydroFoil Republisher
   Purpose:
   - Republish streams to external destinations
   - RTMP push
   - SRT output
   - HLS/WebRTC output profiles if supported through gateway/adapter
   - Per-output credentials and stream keys

   Important:
   - Secrets must be stored encrypted or handled through a secret abstraction.
   - UI must never reveal full stream keys after saving.

D. HydroFoil Remote Recorder
   Purpose:
   - Let a remote Windows/Linux recording agent watch selected streams and record them to a configured folder.
   - Core manages watchlists and policies.
   - Remote agent authenticates to Core.
   - Agent receives signed tasks/jobs.
   - Agent reports status, recording path, file size, duration, errors.
   - Core stores metadata in recording_assets or a related remote_recording_assets table.

   Suggested flow:
   stream.started -> Core event -> remote-recorder plugin checks watchlist -> creates remote-recording-start job -> remote agent starts FFmpeg/SRS pull recording -> reports progress -> stream.stopped -> remote-recording-stop job -> finalize metadata.

E. HydroFoil Audio Generator
   Purpose:
   - Generate MP3/AAC/Opus derivatives from video recordings or live audio captures.
   - Useful for podcast feeds.
   - Uses audio_feed_profiles and generated_audio_assets.

   Future:
   - Automatic podcast RSS feed generation per input/session/collection.

F. HydroFoil DRM
   Purpose:
   - Prepare protected playback workflows.
   - Store DRM policies and packaging state.
   - Integrate with external DRM providers later.
   - Keep Core provider-neutral.

   Important:
   Do not hard-code one DRM vendor into Core.
   Define DRM as a provider interface:
   - packageAsset()
   - createPlaybackPolicy()
   - issuePlaybackToken()
   - revokePlaybackToken()

   The DRM plugin should add DRM policies and packaging jobs but not pollute Core.

G. HydroFoil Analytics
   Purpose:
   - Stream/session metrics
   - Viewer counts
   - Bitrate/health history
   - Recording statistics
   - Gateway status timeline

7. UI Changes
   Add a Plugins area:

   Settings
   - General
   - SRS Gateway
   - Storage
   - Users & Roles
   - Plugins
     - Installed
     - Enabled/Disabled
     - Permissions
     - Settings
     - Logs

   Each plugin may add:
   - sidebar route
   - dashboard cards
   - settings page
   - stream actions
   - recording actions

8. Security Model
   Add a section called “Plugin Security Model”.

   Must include:
   - Core is trusted.
   - Official plugins are semi-trusted but permission-scoped.
   - Third-party plugins are not supported in v1.
   - No arbitrary code upload.
   - Plugin capabilities must be explicit.
   - Sensitive actions require audit logs.
   - Plugin settings are validated with Zod schemas.
   - Secrets are stored separately from normal settings.
   - Plugins cannot read .env directly.
   - Plugins cannot directly access SRS API.
   - Plugins cannot directly access unrestricted DB clients.
   - Plugins must use Core service interfaces.
   - Background jobs must be idempotent.
   - Remote agents must authenticate with scoped tokens.
   - Public playback URLs must be signed or policy-controlled.

9. Developer API
   Add a conceptual TypeScript interface:

interface HydroFoilPlugin {
  id: string;
  name: string;
  version: string;
  register(ctx: PluginContext): void | Promise<void>;
}

interface PluginContext {
  events: EventBus;
  jobs: JobRegistry;
  permissions: PermissionRegistry;
  settings: PluginSettingsRegistry;
  ui: PluginUIRegistry;
  api: PluginApiRegistry;

  services: {
    streams: StreamService;
    routes: RouteService;
    recordings: RecordingService;
    storage: StorageService;
    gateway: GatewayService;
    audit: AuditService;
  };
}

Plugins should receive this context from Core. They should not import internal repositories directly unless explicitly allowed.

10. Proposed Monorepo Structure
   Update file structure suggestion to include:

packages/
  plugin-sdk/
  plugin-runtime/
  permissions/
  audit/
plugins/
  dvr/
  cloud/
  republisher/
  remote-recorder/
  audio-generator/
  drm/
  analytics/

apps/
  remote-recorder-agent/   optional future agent

11. Implementation Plan
   Add a phased roadmap:

Phase 1 — Architecture/documentation
- Update ARCHITECTURE.md.
- Add plugin model to docs.
- Define plugin security model.
- Define event names and job names.

Phase 2 — Core plugin foundation
- Add plugin registry database tables.
- Add plugin-sdk package.
- Add plugin-runtime package.
- Add capability registry.
- Add audit log table.
- Add plugin settings storage.
- Add enabled/disabled plugin mechanism.
- Add Plugins page in Admin UI.

Phase 3 — Event bus and queue hardening
- Make domain events real and post-commit.
- Wire events to Bull/Redis jobs.
- Ensure all job handlers are idempotent.
- Add job status visibility in UI.

Phase 4 — SRS adapter real implementation
- Implement desired gateway reconciliation.
- Implement SRS webhooks.
- Create LiveSession records from publish/unpublish.
- Emit stream.started and stream.stopped.
- Update gateway_config_versions desired/applied state.

Phase 5 — Storage service real implementation
- Wire MinIO/S3 client.
- Implement browse/stat/move/delete/signed URL.
- Make storage locations provider-aware.
- Add secret handling for external S3 providers.

Phase 6 — First official plugin: DVR
- Add DVR plugin manifest.
- Add plugin UI page.
- Add recording policy UI.
- Wire SRS DVR/webhook/finalization flow.
- Store RecordingAsset records.
- Generate signed playback URLs.

Phase 7 — Cloud plugin
- Add S3-compatible upload/sync.
- Add delete-local-after-upload policy.
- Add remote playback URL metadata.
- Add upload retry jobs.

Phase 8 — Republisher plugin
- Add output destination profiles.
- Add RTMP/SRT republish settings.
- Store destination secrets safely.
- Use GatewayService/SRS adapter, not direct SRS access.

Phase 9 — Remote recorder plugin and agent
- Add remote agent registration.
- Add scoped agent tokens.
- Add watchlists.
- Add remote recording jobs.
- Add status reporting.
- Add secure folder/path policy on the agent side.

Phase 10 — Audio generator / podcast plugin
- Generate MP3/AAC/Opus assets.
- Add audio feed profiles.
- Add podcast RSS generation later.

Phase 11 — DRM plugin
- Add provider-neutral DRM interface.
- Add DRM policies.
- Add packaging jobs.
- Add tokenized playback flow.
- Do not hard-code a vendor into Core.

Now make the actual edits to ARCHITECTURE.md.

Be careful:
- Do not remove the existing useful architecture.
- Do not pretend stubbed parts are implemented.
- Mark new plugin architecture as target/proposed unless already implemented.
- Keep the language production-minded but realistic.
- Keep HydroFoil operator-focused.
- Do not create a generic CMS.
- Do not expose raw SRS configuration in the UI.
- Do not add marketplace/plugin upload claims for v1.