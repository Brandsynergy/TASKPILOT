import { NextRequest } from "next/server";
import { runAgent } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const prompt = (body?.prompt ?? "").trim();
  if (!prompt) {
    return Response.json(
      { ok: false, error: "Missing 'prompt' in request body." },
      { status: 400 }
    );
  }
  if (prompt.length > 4000) {
    return Response.json(
      { ok: false, error: "Prompt too long (max 4000 characters)." },
      { status: 400 }
    );
  }

  try {
    const result = await runAgent(prompt);
    return Response.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return Response.json(
      { ok: false, error: (err as Error).message, log: [] },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    ok: true,
    message: "TaskPilot API is running. POST to /api/run with { prompt: string }.",
  });
}
