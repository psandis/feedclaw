import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { FeedclawConfig } from "./types.js";

const DEFAULT_CONFIG: FeedclawConfig = {
  defaultProvider: "anthropic",
  defaultFormat: "terminal",
  digestSince: "24h",
};

export function getHome(): string {
  const home = process.env.FEEDCLAW_HOME || join(homedir(), ".feedclaw");
  if (!existsSync(home)) {
    mkdirSync(home, { recursive: true });
  }
  return home;
}

export function getDbPath(): string {
  return join(getHome(), "feedclaw.db");
}

export function getConfigPath(): string {
  return join(getHome(), "config.json");
}

export function loadConfig(): FeedclawConfig {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(configPath, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: FeedclawConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}
