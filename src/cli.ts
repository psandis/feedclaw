import { readFileSync } from "node:fs";
import chalk from "chalk";
import { Command } from "commander";
import { loadConfig } from "./lib/config.js";
import { closeDb, getDb } from "./lib/db.js";
import { getBundles, getDefaultFeeds } from "./lib/defaults.js";
import { generateDigest } from "./lib/digest.js";
import { addFeed, exportOpml, importOpml, listFeeds, removeFeed } from "./lib/feeds.js";
import { fetchAllFeeds } from "./lib/fetcher.js";
import type { OutputFormat } from "./lib/types.js";

const program = new Command();

program
  .name("feedclaw")
  .description("RSS/Atom feed reader and AI digest builder")
  .version("0.1.0")
  .option("--json", "Output as JSON")
  .option("--db <path>", "Custom database path");

program.hook("preAction", (cmd) => {
  const opts = cmd.opts();
  getDb(opts.db);
});

program.hook("postAction", () => {
  closeDb();
});

// --- init ---
program
  .command("init")
  .description("Set up feedclaw with curated default feeds")
  .option(
    "-b, --bundle <bundle>",
    "Feed bundle: ai, dev, openclaw, news, all (default: all)",
    "all",
  )
  .option("--from <file>", "Load feeds from a custom JSON file")
  .action((opts) => {
    const bundles = getBundles(opts.from);
    const categories = bundles[opts.bundle] || bundles.all || [];
    const feeds = getDefaultFeeds(opts.from).filter((f) => categories.includes(f.category));
    let added = 0;
    for (const f of feeds) {
      try {
        addFeed(f.url, f.category);
        added++;
        if (!program.opts().json) {
          console.log(`${chalk.green("✓")} ${f.title}`);
        }
      } catch {
        if (!program.opts().json) {
          console.log(`${chalk.gray("·")} ${f.title} (already added)`);
        }
      }
    }
    if (program.opts().json) {
      console.log(JSON.stringify({ added, total: feeds.length }));
    } else {
      console.log(
        `\n${chalk.bold.green(String(added))} feeds added. Run ${chalk.cyan("fetch")} to pull articles.`,
      );
    }
  });

// --- add ---
program
  .command("add <url>")
  .description("Add a feed by URL")
  .option("-c, --category <category>", "Feed category", "default")
  .action((url: string, opts) => {
    try {
      const feed = addFeed(url, opts.category);
      if (program.opts().json) {
        console.log(JSON.stringify(feed));
      } else {
        console.log(`${chalk.green("✓")} Added feed: ${feed.url}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE")) {
        console.error(chalk.red("Feed already exists:"), url);
      } else {
        console.error(chalk.red("Error:"), message);
      }
      process.exit(1);
    }
  });

// --- remove ---
program
  .command("remove <url-or-id>")
  .description("Remove a feed by URL or ID")
  .action((urlOrId: string) => {
    const removed = removeFeed(urlOrId);
    if (program.opts().json) {
      console.log(JSON.stringify({ removed }));
    } else if (removed) {
      console.log(`${chalk.green("✓")} Feed removed`);
    } else {
      console.error(chalk.red("Feed not found:"), urlOrId);
      process.exit(1);
    }
  });

// --- list ---
program
  .command("list")
  .description("List subscribed feeds")
  .option("-c, --category <category>", "Filter by category")
  .action((opts) => {
    const feeds = listFeeds(opts.category);
    if (program.opts().json) {
      console.log(JSON.stringify(feeds));
      return;
    }
    if (feeds.length === 0) {
      console.log(chalk.gray("No feeds. Add one with: feedclaw add <url>"));
      return;
    }
    let currentCat = "";
    for (const f of feeds) {
      if (f.category !== currentCat) {
        currentCat = f.category;
        console.log(chalk.bold.cyan(`\n[${currentCat}]`));
      }
      const title = f.title || chalk.gray("(untitled)");
      const lastFetch = f.last_fetched_at ? chalk.gray(` · fetched ${f.last_fetched_at}`) : "";
      console.log(`  ${chalk.white(f.id)}  ${title}${lastFetch}`);
      console.log(`     ${chalk.gray(f.url)}`);
    }
    console.log();
  });

// --- fetch ---
program
  .command("fetch")
  .description("Fetch new articles from feeds")
  .option("-f, --feed <url-or-id>", "Fetch a specific feed")
  .action(async (opts) => {
    const results = await fetchAllFeeds(opts.feed);
    if (program.opts().json) {
      console.log(
        JSON.stringify(
          results.map((r) => ({
            feed: r.feed.url,
            newArticles: r.newArticles,
            error: r.error,
          })),
        ),
      );
      return;
    }
    for (const r of results) {
      if (r.error) {
        console.log(`${chalk.red("✗")} ${r.feed.title || r.feed.url}: ${chalk.red(r.error)}`);
      } else if (r.newArticles > 0) {
        console.log(
          `${chalk.green("✓")} ${r.feed.title || r.feed.url}: ${chalk.bold(String(r.newArticles))} new`,
        );
      } else {
        console.log(
          `${chalk.gray("·")} ${r.feed.title || r.feed.url}: ${chalk.gray("no new articles")}`,
        );
      }
    }
  });

// --- digest ---
program
  .command("digest")
  .description("Generate AI-powered digest of recent articles")
  .option("-s, --since <duration>", "Time window (e.g. 24h, 7d, 2w)")
  .option("-c, --category <category>", "Filter by category")
  .option("-p, --provider <provider>", "AI provider (anthropic, openai)")
  .option("-m, --model <model>", "Model name override")
  .option("-f, --format <format>", "Output format (terminal, markdown, html, json)")
  .option("--max-articles <n>", "Max articles to include", "50")
  .action(async (opts) => {
    const config = loadConfig();
    const output = await generateDigest({
      since: opts.since || config.digestSince,
      category: opts.category,
      provider: opts.provider || config.defaultProvider,
      model: opts.model || config.defaultModel,
      format: (opts.format || config.defaultFormat) as OutputFormat,
      maxArticles: Number(opts.maxArticles),
    });
    console.log(output);
  });

// --- opml-import ---
program
  .command("opml-import <file>")
  .description("Import feeds from OPML file")
  .action((file: string) => {
    const xml = readFileSync(file, "utf-8");
    const added = importOpml(xml);
    if (program.opts().json) {
      console.log(JSON.stringify({ imported: added }));
    } else {
      console.log(`${chalk.green("✓")} Imported ${added} feeds`);
    }
  });

// --- opml-export ---
program
  .command("opml-export")
  .description("Export feeds as OPML")
  .action(() => {
    console.log(exportOpml());
  });

export async function runCli(argv?: string[]): Promise<void> {
  await program.parseAsync(argv || process.argv);
}

runCli().catch((err) => {
  console.error(chalk.red("Fatal:"), err.message);
  process.exit(1);
});
