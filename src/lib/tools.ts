import "server-only";

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any) => Promise<unknown>;
};

const MAX_RESPONSE_BYTES = 20_000; // keep tool output small so the LLM context doesn't explode

function truncate(text: string, max = MAX_RESPONSE_BYTES): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n…[truncated ${text.length - max} chars]`;
}

function stripHtml(html: string): string {
  // Remove script/style blocks entirely
  const withoutBlocks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  // Strip remaining tags
  const text = withoutBlocks.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  const decoded = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded.replace(/\s+/g, " ").trim();
}

async function safeFetch(
  url: string,
  init: RequestInit,
  timeoutMs = 15_000
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    const body = truncate(await res.text());
    return { status: res.status, headers, body };
  } finally {
    clearTimeout(timer);
  }
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "http_request",
    description:
      "Make an HTTP request to any public API or URL. Use this to read data from JSON APIs, submit forms, post to webhooks, etc. Returns status code, headers, and response body (truncated if very long).",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute URL including https://" },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          default: "GET",
        },
        headers: {
          type: "object",
          description: "Optional headers as key/value pairs.",
          additionalProperties: { type: "string" },
        },
        body: {
          type: "string",
          description:
            "Optional request body. For JSON, pass a stringified JSON object and set Content-Type: application/json in headers.",
        },
      },
      required: ["url"],
      additionalProperties: false,
    },
    async execute(args: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }) {
      const { url, method = "GET", headers = {}, body } = args;
      if (!/^https?:\/\//i.test(url)) {
        return { error: "URL must start with http:// or https://" };
      }
      try {
        return await safeFetch(url, { method, headers, body });
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "fetch_webpage_text",
    description:
      "Fetch a webpage and return its cleaned text content (HTML tags stripped). Use this when you want to read an article, blog post, or any HTML page.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute URL of the webpage." },
      },
      required: ["url"],
      additionalProperties: false,
    },
    async execute(args: { url: string }) {
      if (!/^https?:\/\//i.test(args.url)) {
        return { error: "URL must start with http:// or https://" };
      }
      try {
        const res = await safeFetch(args.url, {
          method: "GET",
          headers: { "User-Agent": "TaskPilotBot/1.0" },
        });
        return {
          status: res.status,
          text: truncate(stripHtml(res.body)),
        };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "current_time",
    description:
      "Get the current date and time in ISO 8601 format (UTC) and a human readable form.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute() {
      const now = new Date();
      return {
        iso: now.toISOString(),
        human: now.toUTCString(),
        unix: Math.floor(now.getTime() / 1000),
      };
    },
  },
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}
