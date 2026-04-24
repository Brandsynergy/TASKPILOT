import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "FAL_API_KEY not set" }, { status: 500 });

  try {
    const res = await fetch("https://fal.run/fal-ai/fast-animatediff/text-to-video", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "sunrise over mountains",
        video_size: "portrait_16_9",
        num_frames: 16,
        num_inference_steps: 25,
        fps: 8,
      }),
      signal: AbortSignal.timeout(25000),
    });
    const text = await res.text();
    return NextResponse.json({ status: res.status, body: text.slice(0, 500) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message });
  }
}
