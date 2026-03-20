import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "../src/lib/db.js";
import {
  addFeed,
  exportOpml,
  getFeedById,
  importOpml,
  listFeeds,
  removeFeed,
} from "../src/lib/feeds.js";

let tmpDir: string;
let dbPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "feedclaw-test-"));
  dbPath = join(tmpDir, "test.db");
  getDb(dbPath);
});

afterEach(() => {
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("addFeed", () => {
  it("adds a feed and returns it", () => {
    const feed = addFeed("https://example.com/feed.xml", "tech");
    expect(feed.url).toBe("https://example.com/feed.xml");
    expect(feed.category).toBe("tech");
    expect(feed.id).toBeGreaterThan(0);
  });

  it("throws on duplicate URL", () => {
    addFeed("https://example.com/feed.xml");
    expect(() => addFeed("https://example.com/feed.xml")).toThrow();
  });

  it("defaults category to 'default'", () => {
    const feed = addFeed("https://example.com/feed.xml");
    expect(feed.category).toBe("default");
  });
});

describe("removeFeed", () => {
  it("removes by ID", () => {
    const feed = addFeed("https://example.com/feed.xml");
    expect(removeFeed(String(feed.id))).toBe(true);
    expect(listFeeds()).toHaveLength(0);
  });

  it("removes by URL", () => {
    addFeed("https://example.com/feed.xml");
    expect(removeFeed("https://example.com/feed.xml")).toBe(true);
    expect(listFeeds()).toHaveLength(0);
  });

  it("returns false for non-existent feed", () => {
    expect(removeFeed("999")).toBe(false);
  });
});

describe("listFeeds", () => {
  it("returns empty array when no feeds", () => {
    expect(listFeeds()).toEqual([]);
  });

  it("lists all feeds", () => {
    addFeed("https://a.com/feed.xml", "ai");
    addFeed("https://b.com/feed.xml", "dev");
    expect(listFeeds()).toHaveLength(2);
  });

  it("filters by category", () => {
    addFeed("https://a.com/feed.xml", "ai");
    addFeed("https://b.com/feed.xml", "dev");
    const aiFeeds = listFeeds("ai");
    expect(aiFeeds).toHaveLength(1);
    expect(aiFeeds[0].url).toBe("https://a.com/feed.xml");
  });
});

describe("getFeedById", () => {
  it("returns feed by ID", () => {
    const feed = addFeed("https://example.com/feed.xml");
    const found = getFeedById(feed.id);
    expect(found?.url).toBe("https://example.com/feed.xml");
  });

  it("returns undefined for non-existent ID", () => {
    expect(getFeedById(999)).toBeUndefined();
  });
});

describe("OPML", () => {
  it("imports feeds from OPML", () => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline text="Tech" title="Tech">
      <outline type="rss" text="Feed One" title="Feed One" xmlUrl="https://one.com/feed.xml" htmlUrl="https://one.com" />
      <outline type="rss" text="Feed Two" title="Feed Two" xmlUrl="https://two.com/feed.xml" />
    </outline>
  </body>
</opml>`;
    const added = importOpml(opml);
    expect(added).toBe(2);
    const feeds = listFeeds();
    expect(feeds).toHaveLength(2);
    expect(feeds[0].category).toBe("Tech");
  });

  it("skips duplicates on re-import", () => {
    const opml = `<opml version="2.0"><body>
      <outline type="rss" text="Feed" xmlUrl="https://one.com/feed.xml" />
    </body></opml>`;
    importOpml(opml);
    const added = importOpml(opml);
    expect(added).toBe(0);
    expect(listFeeds()).toHaveLength(1);
  });

  it("exports valid OPML", () => {
    addFeed("https://example.com/feed.xml", "tech");
    const opml = exportOpml();
    expect(opml).toContain('<?xml version="1.0"');
    expect(opml).toContain("opml");
    expect(opml).toContain("https://example.com/feed.xml");
    expect(opml).toContain("tech");
  });

  it("roundtrips import → export → import", () => {
    addFeed("https://a.com/feed.xml", "cat1");
    addFeed("https://b.com/feed.xml", "cat2");
    const exported = exportOpml();

    closeDb();
    const db2Path = join(tmpDir, "test2.db");
    getDb(db2Path);

    const added = importOpml(exported);
    expect(added).toBe(2);
  });
});
