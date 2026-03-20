# Changelog

## 0.1.0 — 2026-03-20

Initial release.

### Features

- Subscribe to RSS and Atom feeds with `add`, `remove`, `list`
- Fetch and store articles in local SQLite with deduplication
- AI-powered digest generation via Anthropic or OpenAI (`digest`)
- Output formats: terminal (colored), markdown, HTML, JSON
- Curated default feeds in `feeds/default.json` — bundles: ai, dev, openclaw, news
- `init` command with bundle selection and custom feed file support (`--from`)
- OPML import and export for feed migration
- `--json` flag on every command for agent and script integration
- Conditional fetch with etag/last-modified (304 support)
- Configurable via `~/.feedclaw/config.json` and environment variables
