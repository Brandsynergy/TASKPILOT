import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { calculateNextRun } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const automations = await db.automation.findMany({
      orderBy: { createdAt: "desc" },
      include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    return Response.json(automations);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, prompt, scheduleType, scheduleHour, scheduleMinute, scheduleDow, scheduleDom } = body;

    if (!name?.trim() || !prompt?.trim()) {
      return Response.json({ error: "name and prompt are required" }, { status: 400 });
    }

    const cfg = {
      scheduleType: scheduleType ?? "manual",
      scheduleHour: scheduleHour ?? 8,
      scheduleMinute: scheduleMinute ?? 0,
      scheduleDow: scheduleDow ?? null,
      scheduleDom: scheduleDom ?? null,
    };

    const nextRunAt = calculateNextRun(cfg);

    const automation = await db.automation.create({
      data: {
        name: name.trim(),
        prompt: prompt.trim(),
        ...cfg,
        nextRunAt,
      },
    });
    return Response.json(automation, { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
