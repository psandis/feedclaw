import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "../src/lib/db.js";
import { addFeed } from "../src/lib/feeds.js";

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

function seedArticles(feedId: number, count: number) {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO articles (feed_id, guid, url, title, summary, published_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (let i = 0; i < count; i++) {
    stmt.run(
      feedId,
      `article-${i}`,
      `https://example.com/${i}`,
      `Article ${i}`,
      `Summary of article ${i}`,
      new Date(Date.now() - i * 3600000).toISOString(),
    );
  }
}

describe("digest", () => {
  it("finds articles within time window", () => {
    const feed = addFeed("https://example.com/feed.xml", "ai");
    seedArticles(feed.id, 5);

    const db = getDb();
    const since = new Date(Date.now() - 48 * 3600000).toISOString();
    const articles = db.prepare("SELECT * FROM articles WHERE fetched_at >= ?").all(since);
    expect(articles).toHaveLength(5);
  });

  it("filters articles by category via join", () => {
    const aiFeed = addFeed("https://ai.com/feed.xml", "ai");
    const devFeed = addFeed("https://dev.com/feed.xml", "dev");
    seedArticles(aiFeed.id, 3);
    seedArticles(devFeed.id, 2);

    const db = getDb();
    const since = new Date(Date.now() - 48 * 3600000).toISOString();
    const articles = db
      .prepare(
        "SELECT a.* FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE a.fetched_at >= ? AND f.category = ?",
      )
      .all(since, "ai");
    expect(articles).toHaveLength(3);
  });

  it("respects max articles limit", () => {
    const feed = addFeed("https://example.com/feed.xml");
    seedArticles(feed.id, 20);

    const db = getDb();
    const since = new Date(Date.now() - 48 * 3600000).toISOString();
    const articles = db
      .prepare("SELECT * FROM articles WHERE fetched_at >= ? ORDER BY published_at DESC LIMIT ?")
      .all(since, 5);
    expect(articles).toHaveLength(5);
  });

  it("marks articles as read after digest", () => {
    const feed = addFeed("https://example.com/feed.xml");
    seedArticles(feed.id, 3);

    const db = getDb();
    const ids = (db.prepare("SELECT id FROM articles").all() as { id: number }[]).map((a) => a.id);

    db.prepare(`UPDATE articles SET is_read = 1 WHERE id IN (${ids.map(() => "?").join(",")})`).run(
      ...ids,
    );

    const unread = db.prepare("SELECT * FROM articles WHERE is_read = 0").all();
    expect(unread).toHaveLength(0);
  });

  it("stores digest in database", () => {
    const db = getDb();
    db.prepare("INSERT INTO digests (model, format, content, article_ids) VALUES (?, ?, ?, ?)").run(
      "test-model",
      "markdown",
      "# Test Digest",
      "[1,2,3]",
    );

    const digests = db.prepare("SELECT * FROM digests").all() as {
      model: string;
      content: string;
    }[];
    expect(digests).toHaveLength(1);
    expect(digests[0].model).toBe("test-model");
    expect(digests[0].content).toBe("# Test Digest");
  });
});
