import type { Article } from "./types.js";

export async function summarizeArticles(
  articles: Article[],
  provider: "anthropic" | "openai",
  model?: string,
): Promise<string> {
  const articleList = articles
    .map((a, i) => {
      const title = a.title || "Untitled";
      const source = a.url || "";
      const summary = a.summary || a.content?.slice(0, 500) || "";
      return `${i + 1}. **${title}**\n   Source: ${source}\n   ${summary}`;
    })
    .join("\n\n");

  const prompt = `You are a news digest curator. Analyze these ${articles.length} RSS articles and create a concise, well-organized digest.

Group articles by topic. For each topic:
- Give a clear topic heading
- Summarize the key points across related articles
- Highlight what matters and why

End with a "Quick Hits" section for standalone items that don't fit a group.

Keep it concise but informative. No fluff.

ARTICLES:
${articleList}`;

  if (provider === "anthropic") {
    return callAnthropic(prompt, model || "claude-sonnet-4-20250514");
  }
  return callOpenAI(prompt, model || "gpt-4o");
}

async function callAnthropic(prompt: string, model: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Export it in your environment to use the digest command.");
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const msg = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  const block = msg.content[0];
  if (block.type === "text") return block.text;
  return "";
}

async function callOpenAI(prompt: string, model: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Export it in your environment to use the digest command.");
  }
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI();
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0]?.message?.content || "";
}
