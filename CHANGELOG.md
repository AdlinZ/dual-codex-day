# Changelog

Project name: **Dual Codex Day** (`dual-codex-day`). Historical entries may retain the original `codex-day` name.

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
