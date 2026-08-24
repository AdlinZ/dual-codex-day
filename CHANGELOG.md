# Changelog

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
