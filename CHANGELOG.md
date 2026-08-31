# Changelog

Project name: **Dual Codex Day** (`dual-codex-day`). Historical entries may retain the original `codex-day` name.

## Unreleased

## [0.19.0] - 2026-08-31

### Added

- Read-only Profile health checks covering active configuration, runtime and usage directories, authentication readiness, client targets, Skills, plugins, usage indexes, active instances, and migration backups.
- Grouped health results in the Electron launch center with normal, warning, and error severity.
- Versioned, sanitized Profile diagnosis export without Profile names, internal ids, usernames, absolute paths, credentials, or log content.

### Security

- Diagnostic exports use renderer-scoped short-lived report tokens; the renderer cannot submit modified report content or a destination path.
- Health checks inspect credential availability without reading or exporting credential values.

### Reliability

- Plugin discovery failures remain isolated and appear as warnings without blocking the rest of the diagnosis.
- Successful Profile creation imports now associate their backup metadata with the created Profile for later health checks.

## [0.18.0] - 2026-08-31

### Added

- Versioned, non-sensitive Profile transfer files for moving Profile metadata, common Codex settings, Skill and plugin state, and usage preferences.
- Import preview for create or update actions, changed sections, missing Skills and plugins, and credential re-entry requirements.

### Security

- Profile transfers reject credential-like fields and exclude authentication files, provider keys, logs, SQLite usage data, and launch history.
- Import apply uses renderer-scoped short-lived tokens; the renderer cannot submit arbitrary transfer paths or modified transfer documents.

### Reliability

- Every import creates a local registry and config backup before writing and restores it automatically if application fails.
- Missing Skills and plugins are reported without automatic installation; existing local provider credentials are cleared only when provider identity changes.

## [0.17.0] - 2026-08-31

### Added

- Side-by-side usage comparison for the default Codex account and every isolated Profile across the active date, model and project filters.
- Click-through task details with interaction-turn, model-call, input, cache, output and total Token breakdowns.
- A pure usage-analysis module with deterministic range, aggregate and task-grouping checks.

### Changed

- Account comparison failures are isolated per data source so one unreadable Profile does not block the complete dashboard.

## [0.16.0] - 2026-08-28

### Added

- Automatic discovery of project-level `.agents/skills` below the user's Documents directory.
- Read-only project columns labeled with the discovered project name, so repository Skills appear without changing the launch workspace.
- A responsive GitHub Pages product site with current Electron screenshots, release downloads and the existing fictional-data demo.
- Automated Pages deployment and local site regression checks.

### Performance

- Project discovery skips dependency, build, VCS and hidden directories and is bounded by depth, directory and project limits.

## [0.15.0] - 2026-08-28

### Added

- A project picker inside Skills management that immediately rescans repository-level `.agents/skills` directories.
- A read-only current-project column so repository Skills are visible without becoming managed global installs.
- A separate Marketplace catalog sourced from `codex plugin list --available --json`, with per-environment install actions.

### Fixed

- Repository Skills no longer disappear from the manager when DCD starts from the user home directory.
- Marketplace candidates and temporary plugin files are no longer confused with installed plugins.

## [0.14.0] - 2026-08-28

### Added

- Plugin-provided Skills inventory sourced from `codex plugin list --json` for each Codex environment.
- Separate standalone and plugin Skill views with bundled Skill names, versions, marketplaces and per-environment availability.
- Explicit plugin installation to a target Profile, including custom Marketplace registration when required.
- Per-environment plugin enable, disable and uninstall controls.

### Fixed

- The Skills page no longer hides Skills bundled by installed plugins.
- Stale plugin cache directories are no longer treated as installed plugins.

### Security

- Plugin synchronization uses the official Codex plugin commands and never copies version-cache directories directly.

## [0.13.0] - 2026-08-28

### Added

- A native Skills management view covering shared, default, Profile-local, repository and bundled Skills.
- Availability matrix, same-name conflict detection, explicit share/sync actions and per-environment enable controls.
- Recoverable Skill removal through the Windows Recycle Bin and a restart reminder after changes.

### Security

- Skill writes are constrained to scanned managed roots; bundled `.system` Skills remain read-only.
- The renderer receives scoped operations only and cannot submit arbitrary configuration or deletion paths.

## [0.12.0] - 2026-08-28

### Added

- Read-only CC Switch Codex usage reconciliation with total, call, date, model and source breakdowns.
- Electron usage ranges for 90 days and custom start/end dates.
- Automatic 30-second refresh while the detailed usage view is open.

### Privacy

- CC Switch reconciliation reads only the selected SQLite database and never writes, imports or exposes session identifiers.

## [0.11.0] - 2026-08-27

### Changed

- Codex usage indexing now follows CC Switch 3.19.2 request semantics for cumulative snapshots, exact per-request usage and root-thread event identities.
- Root, continuation, fork and subagent rollout files are deduplicated with parent replay-prefix filtering.
- Default account, individual Profile and combined account views keep isolated SQLite indexes with explicit source ownership.

### Added

- SQLite schema v4 records source presence, parser provenance, event indexes and token signatures.
- Canonical events remain in the local ledger when a source JSONL disappears after it was indexed by the current parser.
- Diagnostics expose present, missing, deferred and discarded legacy source counts.
- The usage header and diagnostics dialog identify current logs, retained history and deferred files for the selected account scope.

### Fixed

- Repeated `token_count` snapshots no longer inflate model-call and Token totals.
- `total_token_usage` records without `last_token_usage` now use high-water deltas across model changes.
- Legacy missing rows generated by the previous overcounting parser are removed during migration because their canonical usage cannot be reconstructed.
- Diagnostic task counts now use canonical root tasks instead of counting rollout source files.

## [0.10.1] - 2026-08-26

### Added

- Per-instance close controls for running Codex CLI, VS Code and Codex desktop launches.
- Windows Terminal PID handshakes so CLI launch history tracks the real interactive PowerShell process.

### Changed

- Instance shutdown verifies the recorded process start time, requests a normal process-tree close first and uses a forced stop only when required.
- Default-runtime instances show an additional shared-window warning before shutdown.
- Windows CLI launches prefer system Windows PowerShell and use a dedicated Windows Terminal window.

### Fixed

- CLI launches no longer select Codex's bundled PowerShell runtime or exit because no interactive terminal is attached.
- Packaged Electron builds now retain the stop-control icon and can use an alternate output directory while an older build is running.

### Privacy

- Shutdown accepts only a DCD launch-record ID and never scans or terminates unrelated account processes.
- Process identity checks prevent a recycled historical PID from being treated as an owned instance.

## [0.10.0] - 2026-08-25

### Added

- A secure Electron desktop shell that combines profile launching and today's local usage summary.
- A compact profile rail, workspace picker, target availability view and recent-launch activity.
- Persistent launch history, per-profile running indicators and automatic active-instance refresh.
- Per-profile OpenAI/custom-provider settings with generated TOML previews and Responses API configuration.
- Operating-system encrypted custom-provider API keys with profile-scoped launch injection.
- Three custom-provider authentication modes, advanced model preferences and user-selected common `config.toml` import.
- An in-app detailed dashboard window backed by the existing local-only usage service.
- A Windows x64 Electron packaging command and release artifact workflow.

### Changed

- Replaced the legacy activity dial with a geometric Dual C mark across the dashboard, desktop shell and Windows icon.
- The default desktop experience now uses the Electron control center while retaining the native, PowerShell and CLI launchers.
- The Codex desktop action is now the primary launcher and confirms that the detached client process remains alive before reporting success.
- Inherited API credentials remain stripped; custom provider credentials are injected only into the selected profile process.
- Provider updates now merge with existing TOML so plugin, MCP, desktop, notification and project settings remain intact.
- Package metadata, documentation and automated checks now target version 0.10.0.

### Privacy

- Electron renderers are sandboxed with context isolation, no Node.js integration and a local-only content security policy.
- The preload bridge exposes only profile, workspace and dashboard commands; it never reads or references credential files.
- Provider secrets never appear in profile metadata, generated TOML, renderer snapshots or launch history.

## [0.9.0] - 2026-08-25

### Added

- A local multi-account profile launcher with isolated Codex, VS Code and experimental desktop-app state.
- A source-built native Windows GUI with a PowerShell fallback and no third-party launcher service.
- Read-only pricing snapshot audit with freshness classification, official-source validation and optional candidate-file diff.
- A 90-day dashboard range for longer-term personal usage review.
- Configurable Windows daily-summary reminder time at 17:00, 18:00, 20:00 or 22:00.

### Changed

- Renamed the combined launcher and usage dashboard product to Dual Codex Day.
- Refreshed the GPT-5.6 pricing snapshot against the official API pricing page on 2026-08-25.
- Dashboard generation consistently respects a custom `--pricing` snapshot path.

### Privacy

- Profile credentials stay inside each isolated `CODEX_HOME`; the launcher does not read or copy `auth.json` and strips inherited API credential variables.
- Pricing audit never fetches, overwrites or publishes a pricing snapshot; candidate comparison remains an explicit local read-only action.
- Longer dashboard ranges continue to use the same local aggregate and anonymization boundaries.

## [0.8.0] - 2026-08-25

### Added

- Versioned browser-local settings export and validated import with preview-before-save behavior.
- Per-model pricing verification dates and snapshot-age notices without background network access.
- Read-only daily summary command and `/api/summary` endpoint with aggregate-only output.
- Optional Windows tray daily-summary notifications and an on-demand summary action.

### Changed

- The tray now reads detailed counts from `/api/status` while `/healthz` remains a minimal liveness endpoint.

### Privacy

- Settings bundles contain preferences, budgets and project aliases, but no Token events, paths or session identifiers.
- Daily summaries expose aggregate usage and the top model only; they omit project names, paths and session identifiers.

## [0.7.0] - 2026-08-24

### Added

- Schema v2 source diagnostics for invalid JSON, invalid timestamps, duplicate events, empty usage and retention filtering.
- A compact data-health entry and detailed diagnostics drawer in the dashboard.
- Configurable SQLite history retention with automatic recovery scans when the period expands.
- Read-only `doctor` output in human-readable and JSON formats, private paths hidden by default.
- Multi-architecture GHCR image publishing for tagged releases.

### Changed

- `/healthz` now reports minimal liveness while `/api/status` returns detailed, sanitized diagnostics.
- Individual unreadable log files no longer stop the complete indexing pass.

### Privacy

- Retention cleanup never deletes or modifies Codex JSONL logs.
- Public diagnostics omit source paths, raw session identifiers, log content and failed lines.

## [0.6.0] - 2026-08-24

### Added

- SQLite incremental indexing for Codex session and archived-session logs.
- Local HTTP service with health/status endpoints and live refresh.
- API-equivalent cost estimates, budget tracking, pricing modes and coverage reporting.
- Weekly and monthly reports, period comparison, activity heatmap and poster export.
- Dockerfile and Compose deployment with read-only logs and persistent index storage.
- Windows tray mode with health monitoring, automatic recovery and optional user startup.
- Geometric codex-day branding for the dashboard, favicon, README and tray.

### Privacy

- Raw session IDs and full project paths remain private and are not written to public assets.
- Generated personal dashboards, SQLite indexes and exported files remain ignored by Git.
- Cost figures remain estimates based on public API list prices, not relay billing records.
