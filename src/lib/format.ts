import chalk from "chalk";
import type { OutputFormat } from "./types.js";

export function formatDigest(content: string, format: OutputFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify({ digest: content });
    case "html":
      return toHtml(content);
    case "markdown":
      return content;
    case "terminal":
      return toTerminal(content);
  }
}

function toTerminal(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    if (line.startsWith("# ")) {
      out.push(chalk.bold.cyan(`\n${line.slice(2)}`));
      out.push(chalk.cyan("─".repeat(50)));
    } else if (line.startsWith("## ")) {
      out.push(chalk.bold.yellow(`\n${line.slice(3)}`));
    } else if (line.startsWith("### ")) {
      out.push(chalk.bold.white(`\n${line.slice(4)}`));
    } else if (line.startsWith("- ")) {
      out.push(chalk.gray("  • ") + styleLine(line.slice(2)));
    } else if (line.trim() === "") {
      out.push("");
    } else {
      out.push(styleLine(line));
    }
  }
  return out.join("\n");
}

function styleLine(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, (_, m) => chalk.bold(m))
    .replace(/\*(.+?)\*/g, (_, m) => chalk.italic(m))
    .replace(/`(.+?)`/g, (_, m) => chalk.green(m));
}

function toHtml(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\n/g, "\n");

  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>\n$1</ul>\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Feedclaw Digest</title>
<style>
body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.6; }
h1 { color: #e74c3c; border-bottom: 2px solid #e74c3c; padding-bottom: 0.3rem; }
h2 { color: #2c3e50; margin-top: 1.5rem; }
h3 { color: #555; }
ul { padding-left: 1.2rem; }
li { margin: 0.3rem 0; }
code { background: #f4f4f4; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
a { color: #3498db; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}
