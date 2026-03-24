<p align="center">
  <img src="assets/feedclaw.png" alt="Feedclaw" width="400">
</p>

# 🦀 Feedclaw

RSS/Atom feed reader and AI digest builder. Fetch feeds, store articles locally, generate AI-powered summaries. Works standalone or as an OpenClaw skill.

## What It Does

- keeps your feeds and articles in local SQLite
- ships with curated default feeds (AI, dev, news, OpenClaw ecosystem)
- fetches RSS and Atom feeds with conditional requests (etag / 304)
- generates AI-powered digests via Anthropic or OpenAI
- outputs as terminal, markdown, HTML, or JSON
- imports and exports OPML for feed migration
- `--json` flag on most commands for agents and scripts

## Requirements

- Node 22+
- pnpm
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` for digest generation
- Windows: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (C++ workload) for native SQLite compilation

## Install

```bash
git clone https://github.com/psandis/feedclaw.git
cd feedclaw
pnpm install
pnpm build
```

## Quick Start

After install and build:

```bash
pnpm cli init
pnpm cli fetch
pnpm cli digest
```

Set your API key before running `digest`. See [Configuration](#configuration).

## Storage

Default root:

```
~/.feedclaw/
```

Important paths:

- DB: `~/.feedclaw/feedclaw.db`
- Config: `~/.feedclaw/config.json`

Override the root:

```bash
export FEEDCLAW_HOME=/path/to/custom/root
```

## CLI

All commands are run with `pnpm cli <command>`.

### Set up default feeds

```
pnpm cli init

✓ MIT Technology Review
✓ OpenAI Blog
✓ Google AI Blog
✓ Hugging Face Blog
✓ Simon Willison
✓ Lil'Log (Lilian Weng)
✓ GitHub Blog
✓ Cloudflare Blog
✓ Stripe Engineering
✓ Meta Engineering
✓ Peter Steinberger (steipete)
✓ OpenClaw Newsletter
✓ Hacker News
✓ Techmeme
✓ Ars Technica
✓ The Verge

16 feeds added. Run fetch to pull articles.
```

Notes:

- `--bundle ai|dev|openclaw|news|all` picks a subset (default: `all`)
- `--from my-feeds.json` loads feeds from a custom JSON file
- default feeds live in `feeds/default.json` — edit the file or submit a PR

### Add and remove feeds

```bash
pnpm cli add https://blog.rust-lang.org/feed.xml --category dev
pnpm cli remove 3
pnpm cli remove https://example.com/feed.xml
```

Notes:

- `--category <cat>` sets the feed category (default: `default`)
- remove accepts a feed ID or URL

### List subscribed feeds

```
pnpm cli list

[ai]
  1  MIT Technology Review · fetched 2026-03-20 17:30:12
     https://www.technologyreview.com/feed/
  2  OpenAI News · fetched 2026-03-20 17:30:13
     https://openai.com/blog/rss.xml
  5  Simon Willison's Weblog · fetched 2026-03-20 17:30:12
     https://simonwillison.net/atom/everything/

[dev]
  7  The GitHub Blog · fetched 2026-03-20 17:30:12
     https://github.blog/feed/

[openclaw]
  11  Peter Steinberger · fetched 2026-03-20 17:30:12
     https://steipete.me/rss.xml
```

Notes:

- titles are populated after first fetch
- `--category <cat>` filters by category

### Fetch new articles

```
pnpm cli fetch

✓ MIT Technology Review: 10 new
✓ OpenAI News: 891 new
✓ Simon Willison's Weblog: 30 new
✓ The GitHub Blog: 10 new
✓ The Cloudflare Blog: 20 new
✓ Hacker News: Front Page: 20 new
✓ Peter Steinberger: 107 new
✓ Openclaw Newsletter: 30 new
```

Notes:

- `--feed <id|url>` fetches a single feed
- uses etag and last-modified headers to skip unchanged feeds

### Generate AI digest

```bash
pnpm cli digest --since 24h --category ai --format terminal
```

Notes:

- `--since <duration>` sets the time window: `24h`, `7d`, `2w` (default: `24h`)
- `--category <cat>` filters by category
- `--provider anthropic|openai` picks the AI provider (default: `anthropic`)
- `--model <model>` overrides the model
- `--format terminal|markdown|html|json` sets the output format
- `--max-articles <n>` limits articles included (default: `50`)
- only includes unread articles; marks them as read after generating

### Import and export OPML

```bash
pnpm cli opml-import feeds.opml
pnpm cli opml-export > feeds.opml
```

## Typical Workflow

1. run `init` to load default feeds or `init --from` with your own list
2. run `fetch` to pull articles
3. run `digest` to get an AI summary
4. add or remove feeds as needed
5. run `fetch` and `digest` on a schedule

## Configuration

Optional config file at `~/.feedclaw/config.json`:

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultFormat": "terminal",
  "digestSince": "24h"
}
```

Environment variables:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for digest generation |
| `OPENAI_API_KEY` | OpenAI API key for digest generation |
| `FEEDCLAW_HOME` | Custom data directory (default: `~/.feedclaw/`) |

```bash
# macOS / Linux
export ANTHROPIC_API_KEY=sk-ant-...

# Windows (cmd)
set ANTHROPIC_API_KEY=sk-ant-...

# Windows (PowerShell)
$env:ANTHROPIC_API_KEY="sk-ant-..."
```

## Agent Integration

Most commands support `--json` for structured output (except `opml-export` which outputs OPML directly):

```bash
pnpm cli --json list
pnpm cli --json fetch
pnpm cli --json digest --format json
```

### OpenClaw Skill

Once installed globally (`npm install -g feedclaw`), add a `SKILL.md` to your workspace:

```markdown
---
name: feedclaw
description: Fetch RSS feeds and generate AI news digests
version: 1.0.0
requires_binaries:
  - feedclaw
---

When the user asks about news, feeds, or digests, use the `feedclaw` CLI:

- To check feeds: `feedclaw --json fetch`
- To get a digest: `feedclaw --json digest --format markdown`
- To add a feed: `feedclaw --json add <url>`
```

## Default Feeds

Default feeds live in `feeds/default.json`. Edit the file or submit a PR to add feeds.

| Bundle | Feeds |
|--------|-------|
| `ai` | MIT Technology Review, OpenAI, Google AI, Hugging Face, Simon Willison, Lil'Log |
| `dev` | GitHub Blog, Cloudflare, Stripe Engineering, Meta Engineering |
| `openclaw` | Peter Steinberger (steipete), OpenClaw Newsletter |
| `news` | Hacker News, Techmeme, Ars Technica, The Verge |

## Development

```bash
git clone https://github.com/psandis/feedclaw.git
cd feedclaw
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm cli --help
```

## Testing

```bash
pnpm test
```

Current bar:

- 28 tests across feeds, fetcher, and digest modules
- temp SQLite databases per test, cleaned up automatically

## Related

- 🦀 [Dustclaw](https://github.com/psandis/dustclaw) — Find out what is eating your disk space
- 🦀 [Driftclaw](https://github.com/psandis/driftclaw) — Deployment drift detection across environments

## License

See [MIT](LICENSE)
