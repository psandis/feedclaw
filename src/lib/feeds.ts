import { getDb } from "./db.js";
import type { Feed } from "./types.js";

export function addFeed(url: string, category = "default"): Feed {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO feeds (url, category) VALUES (?, ?) RETURNING *");
  return stmt.get(url, category) as Feed;
}

export function removeFeed(urlOrId: string): boolean {
  const db = getDb();
  const id = Number(urlOrId);
  if (!Number.isNaN(id)) {
    return db.prepare("DELETE FROM feeds WHERE id = ?").run(id).changes > 0;
  }
  return db.prepare("DELETE FROM feeds WHERE url = ?").run(urlOrId).changes > 0;
}

export function listFeeds(category?: string): Feed[] {
  const db = getDb();
  if (category) {
    return db
      .prepare("SELECT * FROM feeds WHERE category = ? ORDER BY title, url")
      .all(category) as Feed[];
  }
  return db.prepare("SELECT * FROM feeds ORDER BY category, title, url").all() as Feed[];
}

export function getFeedById(id: number): Feed | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM feeds WHERE id = ?").get(id) as Feed | undefined;
}

export function getFeedByUrl(url: string): Feed | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM feeds WHERE url = ?").get(url) as Feed | undefined;
}

export function updateFeedMeta(
  id: number,
  title: string | null,
  siteUrl: string | null,
  etag: string | null,
  lastModified: string | null,
): void {
  const db = getDb();
  db.prepare(
    `UPDATE feeds SET title = ?, site_url = ?, etag = ?, last_modified = ?, last_fetched_at = datetime('now') WHERE id = ?`,
  ).run(title, siteUrl, etag, lastModified, id);
}

export function importOpml(xml: string): number {
  const feeds: { url: string; title: string; category: string }[] = [];
  let currentCategory = "default";

  for (const line of xml.split("\n")) {
    const trimmed = line.trim();

    const catMatch = trimmed.match(/^<outline\s+text="([^"]*)"[^>]*(?!xmlUrl).*>$/i);
    if (catMatch && !trimmed.includes("xmlUrl")) {
      currentCategory = catMatch[1] || "default";
      continue;
    }

    const urlMatch = trimmed.match(/xmlUrl="([^"]*)"/i);
    if (urlMatch) {
      const titleMatch = trimmed.match(/(?:text|title)="([^"]*)"/i);
      feeds.push({
        url: urlMatch[1],
        title: titleMatch?.[1] || "",
        category: currentCategory,
      });
    }
  }

  const db = getDb();
  const stmt = db.prepare("INSERT OR IGNORE INTO feeds (url, title, category) VALUES (?, ?, ?)");
  let added = 0;
  for (const f of feeds) {
    if (stmt.run(f.url, f.title, f.category).changes > 0) added++;
  }
  return added;
}

export function exportOpml(): string {
  const feeds = listFeeds();
  const categories = new Map<string, Feed[]>();
  for (const f of feeds) {
    const cat = f.category || "default";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)?.push(f);
  }

  let body = "";
  for (const [cat, catFeeds] of categories) {
    body += `    <outline text="${esc(cat)}" title="${esc(cat)}">\n`;
    for (const f of catFeeds) {
      body += `      <outline type="rss" text="${esc(f.title || f.url)}" title="${esc(f.title || f.url)}" xmlUrl="${esc(f.url)}"${f.site_url ? ` htmlUrl="${esc(f.site_url)}"` : ""} />\n`;
    }
    body += "    </outline>\n";
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Feedclaw Subscriptions</title></head>
  <body>
${body}  </body>
</opml>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
