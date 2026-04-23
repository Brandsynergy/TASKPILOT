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
1. ACTION FIRST. If the user asks you to send/post/email/message/publish something, you MUST try to use an action tool (send_email, post_slack, post_discord, send_telegram). Never just summarise and tell the user to send it themselves.
2. If an action tool returns an error saying a credential is missing, tell the user PLAINLY which env var to set (e.g. RESEND_API_KEY) and where to get it. Do not give up silently.
3. For data gathering, use http_request (JSON APIs) or fetch_webpage_text (HTML pages). Prefer direct JSON APIs over scraping.
4. Chain tools when needed: read data first, then act on it. Example: fetch news, then send_email with the summary.
5. Do NOT invent facts or fabricate tool outputs. If a tool fails, either retry differently or report the failure clearly.
6. Keep the final user-facing answer short (<200 words) and confirm what was ACTUALLY done (e.g. "Email sent to X" or "Posted to Slack channel #Y"). Do not paste raw JSON.
7. If the user's request genuinely cannot be completed with the available tools, say exactly what's missing (e.g. "I need a Slack webhook URL to post to Slack. Paste one into your prompt.").`;

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
