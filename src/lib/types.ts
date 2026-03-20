export interface Feed {
  id: number;
  url: string;
  title: string | null;
  site_url: string | null;
  category: string;
  added_at: string;
  last_fetched_at: string | null;
  etag: string | null;
  last_modified: string | null;
}

export interface Article {
  id: number;
  feed_id: number;
  guid: string;
  url: string | null;
  title: string | null;
  author: string | null;
  content: string | null;
  summary: string | null;
  published_at: string | null;
  fetched_at: string;
  is_read: number;
}

export interface Digest {
  id: number;
  created_at: string;
  model: string;
  format: string;
  content: string;
  article_ids: string;
}

export interface DigestOptions {
  since: string;
  category?: string;
  provider: "anthropic" | "openai";
  model?: string;
  format: OutputFormat;
  maxArticles: number;
}

export type OutputFormat = "terminal" | "markdown" | "html" | "json";

export interface FeedclawConfig {
  defaultProvider: "anthropic" | "openai";
  defaultModel?: string;
  defaultFormat: OutputFormat;
  digestSince: string;
}
