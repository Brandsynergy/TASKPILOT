import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MODEL = "fal-ai/t2v-turbo";

async function falFetch(url: string, options: RequestInit) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
}

export async function GET() {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "FAL_API_KEY not set" }, { status: 500 });

  const headers = {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
  };

  try {
    // Step 1: Submit to queue
    const submit = await falFetch(`https://queue.fal.run/${MODEL}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: "sunrise over mountains, cinematic, vertical", num_frames: 16, num_inference_steps: 4 }),
    });
    const submitData = await submit.json() as { request_id?: string };
    if (!submitData.request_id) return NextResponse.json({ step: "submit", status: submit.status, data: submitData });

    const { request_id } = submitData;

    // Step 2: Poll for completion
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 4000));
      const status = await falFetch(`https://queue.fal.run/${MODEL}/requests/${request_id}/status`, { method: "GET", headers });
      const s = await status.json() as { status: string };
      if (s.status === "COMPLETED") {
        const result = await falFetch(`https://queue.fal.run/${MODEL}/requests/${request_id}`, { method: "GET", headers });
        const r = await result.json() as { video?: { url: string } };
        return NextResponse.json({ ok: true, video_url: r?.video?.url, raw: JSON.stringify(r).slice(0, 400) });
      }
      if (s.status === "FAILED") return NextResponse.json({ failed: true, details: s });
    }
    return NextResponse.json({ error: "Timed out after 80 seconds" });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message });
  }
}
