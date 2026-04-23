import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { runAgent } from "@/lib/agent";
import { calculateNextRun } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/automations/[id]/run">) {
  const { id } = await ctx.params;

  const automation = await db.automation.findUnique({ where: { id } });
  if (!automation) return Response.json({ error: "Not found" }, { status: 404 });

  // Create a "running" run record
  const run = await db.run.create({
    data: { automationId: id, status: "running" },
  });

  try {
    const result = await runAgent(automation.prompt);
    const nextRunAt = calculateNextRun(automation);

    await db.run.update({
      where: { id: run.id },
      data: {
        status: result.ok ? "success" : "failed",
        result: result.summary ?? result.error,
        logJson: JSON.stringify(result.log),
        finishedAt: new Date(),
      },
    });

    await db.automation.update({
      where: { id },
      data: { lastRunAt: new Date(), nextRunAt },
    });

    return Response.json({ ok: result.ok, runId: run.id, summary: result.summary ?? result.error });
  } catch (err) {
    await db.run.update({
      where: { id: run.id },
      data: { status: "failed", result: (err as Error).message, finishedAt: new Date() },
    });
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
