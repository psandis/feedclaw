import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface DefaultFeed {
  url: string;
  title: string;
  category: string;
}

interface FeedsFile {
  bundles: Record<string, string>;
  feeds: DefaultFeed[];
}

function loadFeedsFile(customPath?: string): FeedsFile {
  if (customPath) {
    return JSON.parse(readFileSync(customPath, "utf-8"));
  }

  // Look for feeds/default.json relative to package root
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(thisDir, "..", "..", "feeds", "default.json"),
    join(thisDir, "..", "feeds", "default.json"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, "utf-8"));
    }
  }

  return { bundles: {}, feeds: [] };
}

export function getDefaultFeeds(customPath?: string): DefaultFeed[] {
  return loadFeedsFile(customPath).feeds;
}

export function getBundles(customPath?: string): Record<string, string[]> {
  const data = loadFeedsFile(customPath);
  const categories = Object.keys(data.bundles);
  const result: Record<string, string[]> = {};
  for (const cat of categories) {
    result[cat] = [cat];
  }
  result.all = categories;
  return result;
}
