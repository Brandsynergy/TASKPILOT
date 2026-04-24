import "server-only";
import OpenAI from "openai";
import { TOOLS, getToolByName } from "./tools";

export type LogEntry = {
  kind: "thought" | "tool" | "tool-result" | "final" | "error";
  text: string;
};

export type AgentResult = {
  ok: boolean;
  summary?: string;
  log: LogEntry[];
  error?: string;
};

const MAX_ITERATIONS = 12;
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const SYSTEM_PROMPT = `You are TaskPilot, an autonomous task EXECUTION agent. Your job is to ACTUALLY DO THINGS, not just answer questions.

Core rules:
1. ACTION FIRST. Always use tools to DO things — never just describe what you would do.
2. For motivational/inspirational quotes, ALWAYS use get_quote. Never search the internet.
3. For images, use generate_image. Describe ONLY the visual scene — never include words, text, quotes or letters in the image prompt. Text belongs in the email body, not the image.
4. For email delivery, use send_email with the quote as the body and the image URL embedded in HTML.
5. For other channels: post_slack, post_discord, send_telegram, post_publer.
6. For data (news, weather, prices), use http_request or fetch_webpage_text.
7. If a credential is missing, tell the user exactly which env var to set.
8. Keep the final answer under 100 words and confirm what was ACTUALLY done.`;

function buildOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to your .env.local (locally) or to Render environment variables (in production)."
    );
  }
  return new OpenAI({ apiKey });
}

// OpenAI tool schema format
const openAiTools = TOOLS.map((t) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  },
}));

export async function runAgent(userPrompt: string): Promise<AgentResult> {
  const log: LogEntry[] = [];
  const openai = buildOpenAIClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: openAiTools,
      tool_choice: "auto",
      temperature: 0.3,
    });

    const choice = completion.choices[0];
    const msg = choice.message;
    messages.push(msg);

    if (msg.content && (!msg.tool_calls || msg.tool_calls.length === 0)) {
      log.push({ kind: "final", text: msg.content });
      return { ok: true, summary: msg.content, log };
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        const fn = tc.function;
        const tool = getToolByName(fn.name);
        log.push({ kind: "tool", text: `${fn.name}(${fn.arguments})` });

        if (!tool) {
          const err = `Unknown tool: ${fn.name}`;
          log.push({ kind: "tool-result", text: err });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: err }),
          });
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let parsedArgs: any = {};
        try {
          parsedArgs = fn.arguments ? JSON.parse(fn.arguments) : {};
        } catch {
          const err = `Invalid JSON arguments for ${fn.name}`;
          log.push({ kind: "tool-result", text: err });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: err }),
          });
          continue;
        }

        try {
          const result = await tool.execute(parsedArgs);
          const resultStr = JSON.stringify(result);
          log.push({
            kind: "tool-result",
            text: resultStr.length > 800 ? resultStr.slice(0, 800) + "…" : resultStr,
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: resultStr,
          });
        } catch (err) {
          const message = (err as Error).message;
          log.push({ kind: "tool-result", text: `ERROR: ${message}` });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: message }),
          });
        }
      }
      continue;
    }

    // No content and no tool calls – bail out.
    log.push({ kind: "error", text: "Model returned no content and no tool calls." });
    return { ok: false, error: "Model returned empty response.", log };
  }

  log.push({
    kind: "error",
    text: `Stopped after ${MAX_ITERATIONS} iterations without a final answer.`,
  });
  return {
    ok: false,
    error: `Task did not complete within ${MAX_ITERATIONS} steps. Try a simpler prompt.`,
    log,
  };
}
