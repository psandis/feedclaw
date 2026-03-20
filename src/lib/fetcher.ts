import { extractFromXml } from "@extractus/feed-extractor";
import { getDb } from "./db.js";
import { getFeedById, listFeeds, updateFeedMeta } from "./feeds.js";
import type { Feed } from "./types.js";

interface FetchResult {
  feed: Feed;
  newArticles: number;
  error?: string;
}

export async function fetchFeed(feed: Feed): Promise<FetchResult> {
  try {
    const headers: Record<string, string> = {};
    if (feed.etag) headers["If-None-Match"] = feed.etag;
    if (feed.last_modified) headers["If-Modified-Since"] = feed.last_modified;

    const res = await fetch(feed.url, { headers });

    if (res.status === 304) {
      updateFeedMeta(feed.id, feed.title, feed.site_url, feed.etag, feed.last_modified);
      return { feed, newArticles: 0 };
    }

    if (!res.ok) {
      return { feed, newArticles: 0, error: `HTTP ${res.status}` };
    }

    const xml = await res.text();
    const parsed = extractFromXml(xml, { xmlParserOptions: { processEntities: false } });

    if (!parsed) {
      return { feed, newArticles: 0, error: "Failed to parse feed" };
    }

    const etag = res.headers.get("etag") || null;
    const lastModified = res.headers.get("last-modified") || null;
    const updatedTitle = parsed.title || feed.title;
    const updatedSiteUrl = parsed.link || feed.site_url;
    updateFeedMeta(feed.id, updatedTitle, updatedSiteUrl, etag, lastModified);
    feed.title = updatedTitle;
    feed.site_url = updatedSiteUrl;

    const db = getDb();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO articles (feed_id, guid, url, title, author, content, summary, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let newArticles = 0;
    for (const entry of parsed.entries || []) {
      const guid = entry.id || entry.link || entry.title || "";
      if (!guid) continue;

      const result = stmt.run(
        feed.id,
        guid,
        entry.link || null,
        entry.title || null,
        null,
        null,
        entry.description || null,
        entry.published || null,
      );
      if (result.changes > 0) newArticles++;
    }

    return { feed, newArticles };
  } catch (err) {
    return {
      feed,
      newArticles: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchAllFeeds(feedUrlOrId?: string): Promise<FetchResult[]> {
  if (feedUrlOrId) {
    const id = Number(feedUrlOrId);
    let feed: Feed | undefined;
    if (!Number.isNaN(id)) {
      feed = getFeedById(id);
    }
    if (!feed) {
      const db = getDb();
      feed = db.prepare("SELECT * FROM feeds WHERE url = ?").get(feedUrlOrId) as Feed | undefined;
    }
    if (!feed) {
      return [
        {
          feed: { url: feedUrlOrId } as Feed,
          newArticles: 0,
          error: "Feed not found",
        },
      ];
    }
    return [await fetchFeed(feed)];
  }

  const feeds = listFeeds();
  return Promise.all(feeds.map((f) => fetchFeed(f)));
}
