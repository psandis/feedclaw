import { summarizeArticles } from "./ai.js";
import { getDb } from "./db.js";
import { formatDigest } from "./format.js";
import type { Article, DigestOptions } from "./types.js";

function parseSince(since: string): string {
  const match = since.match(/^(\d+)(h|d|w)$/);
  if (!match) throw new Error(`Invalid --since value: "${since}". Use e.g. 24h, 7d, 2w`);

  const [, num, unit] = match;
  const hours = unit === "h" ? Number(num) : unit === "d" ? Number(num) * 24 : Number(num) * 24 * 7;

  const date = new Date(Date.now() - hours * 60 * 60 * 1000);
  return date.toISOString();
}

export async function generateDigest(opts: DigestOptions): Promise<string> {
  const db = getDb();
  const since = parseSince(opts.since);

  let query = `
    SELECT a.* FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    WHERE a.fetched_at >= ? AND a.is_read = 0
  `;
  const params: (string | number)[] = [since];

  if (opts.category) {
    query += " AND f.category = ?";
    params.push(opts.category);
  }

  query += " ORDER BY a.published_at DESC LIMIT ?";
  params.push(opts.maxArticles);

  const articles = db.prepare(query).all(...params) as Article[];

  if (articles.length === 0) {
    return "No new articles found for the given time period.";
  }

  const model =
    opts.model || (opts.provider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o");

  const summary = await summarizeArticles(articles, opts.provider, model);

  // Store digest
  db.prepare("INSERT INTO digests (model, format, content, article_ids) VALUES (?, ?, ?, ?)").run(
    model,
    opts.format,
    summary,
    JSON.stringify(articles.map((a) => a.id)),
  );

  // Mark articles as read
  const ids = articles.map((a) => a.id);
  if (ids.length > 0) {
    db.prepare(`UPDATE articles SET is_read = 1 WHERE id IN (${ids.map(() => "?").join(",")})`).run(
      ...ids,
    );
  }

  return formatDigest(summary, opts.format);
}
