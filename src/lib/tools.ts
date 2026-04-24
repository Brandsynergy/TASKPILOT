import "server-only";
import { db } from "@/lib/db";

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
  {
    name: "send_email",
    description:
      "ACTION: Actually send a real email. Uses Resend under the hood. Requires RESEND_API_KEY to be set in the server environment. If it's not set, this tool returns an error explaining how to configure it. Use this whenever the user asks to email, mail, or send something to an email address.",
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient email address, e.g. user@example.com.",
        },
        subject: { type: "string", description: "Email subject line." },
        body: {
          type: "string",
          description:
            "Email body. Plain text or simple HTML. If HTML, wrap in <p> tags etc.",
        },
        from: {
          type: "string",
          description:
            "Optional sender address. Defaults to the RESEND_FROM env var or onboarding@resend.dev (Resend's sandbox sender).",
        },
      },
      required: ["to", "subject", "body"],
      additionalProperties: false,
    },
    async execute(args: {
      to: string;
      subject: string;
      body: string;
      from?: string;
    }) {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        return {
          error:
            "Email sending is not configured. Sign up at https://resend.com (free), create an API key, then add RESEND_API_KEY to the Render environment variables for this service.",
        };
      }
      const from =
        args.from ?? process.env.RESEND_FROM ?? "onboarding@resend.dev";
      const isHtml = /<[a-z][\s\S]*>/i.test(args.body);
      try {
        const res = await safeFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [args.to],
            subject: args.subject,
            [isHtml ? "html" : "text"]: args.body,
          }),
        });
        if (res.status >= 200 && res.status < 300) {
          return { ok: true, status: res.status, provider: "resend" };
        }
        return {
          ok: false,
          status: res.status,
          error: res.body,
        };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "post_slack",
    description:
      "ACTION: Post a message to a Slack channel via an Incoming Webhook URL. The user must provide the webhook_url (obtained from Slack > Apps > Incoming Webhooks). No other auth needed.",
    parameters: {
      type: "object",
      properties: {
        webhook_url: {
          type: "string",
          description:
            "Full Slack Incoming Webhook URL, e.g. https://hooks.slack.com/services/XXX/YYY/ZZZ.",
        },
        text: { type: "string", description: "The message text to post." },
      },
      required: ["webhook_url", "text"],
      additionalProperties: false,
    },
    async execute(args: { webhook_url: string; text: string }) {
      if (!/^https:\/\/hooks\.slack\.com\//i.test(args.webhook_url)) {
        return {
          error:
            "webhook_url must be a Slack incoming webhook URL (https://hooks.slack.com/...).",
        };
      }
      try {
        const res = await safeFetch(args.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: args.text }),
        });
        return { ok: res.status === 200, status: res.status, body: res.body };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "post_discord",
    description:
      "ACTION: Post a message to a Discord channel via a webhook URL. User must provide the webhook_url (from Discord > Channel > Integrations > Webhooks).",
    parameters: {
      type: "object",
      properties: {
        webhook_url: {
          type: "string",
          description: "Discord webhook URL, e.g. https://discord.com/api/webhooks/...",
        },
        content: { type: "string", description: "The message text to post." },
        username: {
          type: "string",
          description: "Optional override display name for the bot.",
        },
      },
      required: ["webhook_url", "content"],
      additionalProperties: false,
    },
    async execute(args: {
      webhook_url: string;
      content: string;
      username?: string;
    }) {
      if (
        !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//i.test(
          args.webhook_url
        )
      ) {
        return {
          error:
            "webhook_url must be a Discord webhook URL (https://discord.com/api/webhooks/...).",
        };
      }
      try {
        const res = await safeFetch(args.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: args.content,
            ...(args.username ? { username: args.username } : {}),
          }),
        });
        return { ok: res.status < 300, status: res.status, body: res.body };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "send_telegram",
    description:
      "ACTION: Send a message via Telegram. The user must provide a bot_token (from @BotFather) and a chat_id (their user id or channel id). If TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set as environment variables, those are used as defaults.",
    parameters: {
      type: "object",
      properties: {
        bot_token: {
          type: "string",
          description:
            "Telegram bot token from @BotFather. Optional if TELEGRAM_BOT_TOKEN env var is set.",
        },
        chat_id: {
          type: "string",
          description:
            "Telegram chat id. Optional if TELEGRAM_CHAT_ID env var is set.",
        },
        text: { type: "string", description: "Message text to send." },
      },
      required: ["text"],
      additionalProperties: false,
    },
    async execute(args: { bot_token?: string; chat_id?: string; text: string }) {
      const token = args.bot_token ?? process.env.TELEGRAM_BOT_TOKEN;
      const chatId = args.chat_id ?? process.env.TELEGRAM_CHAT_ID;
      if (!token || !chatId) {
        return {
          error:
            "Missing Telegram credentials. Either pass bot_token + chat_id, or set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars.",
        };
      }
      try {
        const res = await safeFetch(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: args.text }),
          }
        );
        return { ok: res.status === 200, status: res.status, body: res.body };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "get_contacts",
    description:
      "Fetch contacts from the TaskPilot contacts database. Returns a list of contacts with name, email, phone, and any extra fields. Use this before loop automations — e.g. 'for each contact, send an email'. Optionally filter by list name.",
    parameters: {
      type: "object",
      properties: {
        list_name: {
          type: "string",
          description:
            "Optional list name to filter contacts by. If omitted, returns all contacts.",
        },
        limit: {
          type: "number",
          description: "Max number of contacts to return. Defaults to 50.",
        },
      },
      additionalProperties: false,
    },
    async execute(args: { list_name?: string; limit?: number }) {
      try {
        const contacts = await db.contact.findMany({
          where: args.list_name ? { listName: args.list_name } : undefined,
          take: args.limit ?? 50,
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            listName: true,
            extraJson: true,
          },
        });
        return {
          count: contacts.length,
          contacts: contacts.map((c) => ({
            ...c,
            extra: c.extraJson ? JSON.parse(c.extraJson) : undefined,
            extraJson: undefined,
          })),
        };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "generate_image",
    description:
      "ACTION: Generate an image from a text prompt using Flux AI (via fal.ai). Returns a public image URL you can use in other tools. Requires FAL_API_KEY env var. Use this to create illustrations, social media visuals, motivational quote backgrounds, etc.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description:
            "Detailed description of the image to generate. Be specific about style, mood, colours, subject.",
        },
        size: {
          type: "string",
          enum: ["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"],
          description: "Image dimensions. Use square_hd for social posts (default). portrait_16_9 for TikTok/Reels.",
        },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
    async execute(args: { prompt: string; size?: string }) {
      const apiKey = process.env.FAL_API_KEY;
      if (!apiKey) {
        return {
          error:
            "Image generation is not configured. Sign up at https://fal.ai, get a free API key, then add FAL_API_KEY to your Render environment variables.",
        };
      }
      try {
        const res = await safeFetch(
          "https://fal.run/fal-ai/flux/schnell",
          {
            method: "POST",
            headers: {
              Authorization: `Key ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: args.prompt,
              image_size: args.size ?? "square_hd",
              num_images: 1,
              num_inference_steps: 4,
            }),
          },
          30_000
        );
        if (res.status !== 200) {
          return { error: `fal.ai returned ${res.status}: ${res.body}` };
        }
        const data = JSON.parse(res.body);
        const imageUrl = data?.images?.[0]?.url;
        if (!imageUrl) return { error: "No image returned from fal.ai", raw: res.body };
        return { ok: true, image_url: imageUrl };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
  {
    name: "post_publer",
    description:
      "ACTION: Immediately publish a social media post via Publer. Supports TikTok, Instagram, Facebook, Twitter/X, LinkedIn and more. Requires PUBLER_API_KEY. Auto-discovers workspace and account IDs. Can include text and image URLs.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Post caption / text content." },
        platform: {
          type: "string",
          description: "Target platform e.g. tiktok, instagram, facebook, twitter, linkedin. If omitted, posts to all connected accounts.",
        },
        media_urls: {
          type: "array",
          items: { type: "string" },
          description: "Optional public image URLs to attach.",
        },
        scheduled_at: {
          type: "string",
          description: "Optional ISO 8601 datetime to schedule (e.g. 2025-01-01T09:00:00Z). Omit to post immediately.",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
    async execute(args: {
      text: string;
      platform?: string;
      media_urls?: string[];
      scheduled_at?: string;
    }) {
      const apiKey = process.env.PUBLER_API_KEY;
      if (!apiKey) {
        return { error: "PUBLER_API_KEY is not set. Add it in Render > taskpilot > Environment." };
      }

      const BASE = "https://app.publer.com/api/v1";
      // Publer v1 auth format is Bearer-API (not Bearer)
      const authBase = {
        Authorization: `Bearer-API ${apiKey}`,
        "Content-Type": "application/json",
      };

      // Step 1 — auto-fetch workspace ID
      let workspaceId = process.env.PUBLER_WORKSPACE_ID ?? "";
      if (!workspaceId) {
        try {
          const wRes = await safeFetch(`${BASE}/workspaces`, { method: "GET", headers: authBase });
          if (wRes.status === 200) {
            const ws = JSON.parse(wRes.body);
            workspaceId = (Array.isArray(ws) ? ws[0]?.id : ws?.id) ?? "";
          }
          if (!workspaceId) return { error: `Cannot find Publer workspace. Check PUBLER_API_KEY. Response: ${wRes.body}` };
        } catch (err) {
          return { error: `Workspace fetch failed: ${(err as Error).message}` };
        }
      }

      const headers = { ...authBase, "Publer-Workspace-Id": String(workspaceId) };

      // Step 2 — auto-fetch accounts
      let accountIds: string[] = (process.env.PUBLER_ACCOUNT_IDS ?? "")
        .split(",").map((s) => s.trim()).filter(Boolean);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let accountsData: any[] = [];
      if (accountIds.length === 0) {
        try {
          const aRes = await safeFetch(`${BASE}/accounts`, { method: "GET", headers });
          if (aRes.status !== 200) {
            return { error: `Cannot fetch accounts (HTTP ${aRes.status}): ${aRes.body}` };
          }
          accountsData = JSON.parse(aRes.body);
          if (!accountsData?.length) {
            return { error: "No connected accounts found in Publer. Connect TikTok/Instagram etc. first." };
          }
          const filter = args.platform?.toLowerCase();
          const matches = filter
            ? accountsData.filter((a) =>
                a.provider?.toLowerCase() === filter ||
                a.name?.toLowerCase().includes(filter)
              )
            : accountsData;
          accountIds = (matches.length ? matches : accountsData).map((a: {id: string}) => String(a.id));
        } catch (err) {
          return { error: `Account fetch failed: ${(err as Error).message}` };
        }
      }

      // Step 3 — build network content per account
      // Determine provider for network key (default to tiktok if platform specified)
      const networkKey = args.platform?.toLowerCase() ?? "tiktok";
      const hasMedia = (args.media_urls?.length ?? 0) > 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const networkContent: Record<string, any> = {
        [networkKey]: {
          type: hasMedia ? "photo" : "status",
          text: args.text,
          ...(hasMedia ? { media: args.media_urls!.map((url) => ({ url, type: "image" })) } : {}),
        },
      };

      const accountEntries = accountIds.map((id) => ({
        id,
        ...(args.scheduled_at ? { scheduled_at: args.scheduled_at } : {}),
      }));

      const postBody = {
        bulk: {
          state: "scheduled",
          posts: [{ networks: networkContent, accounts: accountEntries }],
        },
      };

      // Step 4 — publish
      const endpoint = args.scheduled_at
        ? `${BASE}/posts/schedule`
        : `${BASE}/posts/schedule/publish`;

      try {
        const pRes = await safeFetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(postBody),
        });

        if (pRes.status < 200 || pRes.status >= 300) {
          return { ok: false, status: pRes.status, error: pRes.body, account_ids: accountIds };
        }

        const result = JSON.parse(pRes.body);
        const jobId = result?.job_id ?? result?.data?.job_id;

        if (!jobId) return { ok: true, status: pRes.status, response: pRes.body };

        // Step 5 — poll job status (up to 15s)
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          const sRes = await safeFetch(`${BASE}/job_status/${jobId}`, { method: "GET", headers });
          if (sRes.status === 200) {
            const s = JSON.parse(sRes.body);
            if (s.status === "complete" || s.status === "completed") {
              return { ok: true, job_id: jobId, status: "complete", account_ids: accountIds };
            }
            if (s.status === "failed") {
              return { ok: false, job_id: jobId, status: "failed", details: s };
            }
          }
        }
        // Still processing — likely succeeded
        return { ok: true, job_id: jobId, status: "processing", account_ids: accountIds };
      } catch (err) {
        return { error: (err as Error).message };
      }
    },
  },
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}
