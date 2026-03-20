import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "../src/lib/db.js";
import { addFeed } from "../src/lib/feeds.js";
import { fetchFeed } from "../src/lib/fetcher.js";
import type { Feed } from "../src/lib/types.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "feedclaw-test-"));
  getDb(join(tmpDir, "test.db"));
});

afterEach(() => {
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const MOCK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <item>
      <title>Article One</title>
      <link>https://example.com/1</link>
      <guid>article-1</guid>
      <description>First article summary</description>
      <pubDate>Thu, 20 Mar 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Article Two</title>
      <link>https://example.com/2</link>
      <guid>article-2</guid>
      <description>Second article summary</description>
      <pubDate>Thu, 20 Mar 2026 11:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const MOCK_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <link href="https://example.com"/>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.com/atom-1"/>
    <id>atom-entry-1</id>
    <summary>An atom entry</summary>
    <updated>2026-03-20T10:00:00Z</updated>
  </entry>
</feed>`;

function mockFetch(body: string, status = 200, headers: Record<string, string> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(body),
      headers: {
        get: (name: string) => headers[name.toLowerCase()] || null,
      },
    }),
  );
}

describe("fetchFeed", () => {
  it("parses RSS and stores articles", async () => {
    mockFetch(MOCK_RSS);
    const feed = addFeed("https://example.com/feed.xml");
    const result = await fetchFeed(feed);

    expect(result.newArticles).toBe(2);
    expect(result.error).toBeUndefined();

    const db = getDb();
    const articles = db.prepare("SELECT * FROM articles WHERE feed_id = ?").all(feed.id);
    expect(articles).toHaveLength(2);
  });

  it("parses Atom feeds", async () => {
    mockFetch(MOCK_ATOM);
    const feed = addFeed("https://example.com/atom.xml");
    const result = await fetchFeed(feed);

    expect(result.newArticles).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it("updates feed title from parsed data", async () => {
    mockFetch(MOCK_RSS);
    const feed = addFeed("https://example.com/feed.xml");
    await fetchFeed(feed);

    const db = getDb();
    const updated = db.prepare("SELECT title FROM feeds WHERE id = ?").get(feed.id) as {
      [key: string]: string;
    };
    expect(updated.title).toBe("Test Feed");
  });

  it("deduplicates articles on re-fetch", async () => {
    mockFetch(MOCK_RSS);
    const feed = addFeed("https://example.com/feed.xml");

    await fetchFeed(feed);
    const result2 = await fetchFeed(feed);

    expect(result2.newArticles).toBe(0);

    const db = getDb();
    const articles = db.prepare("SELECT * FROM articles WHERE feed_id = ?").all(feed.id);
    expect(articles).toHaveLength(2);
  });

  it("handles HTTP errors", async () => {
    mockFetch("", 404);
    const feed = addFeed("https://example.com/feed.xml");
    const result = await fetchFeed(feed);

    expect(result.newArticles).toBe(0);
    expect(result.error).toBe("HTTP 404");
  });

  it("handles 304 Not Modified", async () => {
    mockFetch("", 304);
    const feed = addFeed("https://example.com/feed.xml");
    // Simulate having etag from a previous fetch
    const db = getDb();
    db.prepare("UPDATE feeds SET etag = ? WHERE id = ?").run('"abc123"', feed.id);

    const updatedFeed = db.prepare("SELECT * FROM feeds WHERE id = ?").get(feed.id) as Feed;
    const result = await fetchFeed(updatedFeed);

    expect(result.newArticles).toBe(0);
    expect(result.error).toBeUndefined();
  });

  it("handles network errors gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const feed = addFeed("https://example.com/feed.xml");
    const result = await fetchFeed(feed);

    expect(result.newArticles).toBe(0);
    expect(result.error).toBe("Network error");
  });

  it("stores etag and last-modified from response", async () => {
    mockFetch(MOCK_RSS, 200, {
      etag: '"xyz789"',
      "last-modified": "Thu, 20 Mar 2026 12:00:00 GMT",
    });
    const feed = addFeed("https://example.com/feed.xml");
    await fetchFeed(feed);

    const db = getDb();
    const updated = db
      .prepare("SELECT etag, last_modified FROM feeds WHERE id = ?")
      .get(feed.id) as { [key: string]: string };
    expect(updated.etag).toBe('"xyz789"');
    expect(updated.last_modified).toBe("Thu, 20 Mar 2026 12:00:00 GMT");
  });
});
