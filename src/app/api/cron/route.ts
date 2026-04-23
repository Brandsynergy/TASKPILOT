import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { runAgent } from "@/lib/agent";
import { calculateNextRun } from "@/lib/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Protect with a shared secret so only our cron caller can trigger this
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided =
      req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
    if (provided !== secret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  // Find all enabled automations that are due
  const due = await db.automation.findMany({
    where: {
      enabled: true,
      scheduleType: { not: "manual" },
      nextRunAt: { lte: now },
    },
  });

  if (due.length === 0) {
    return Response.json({ ok: true, ran: 0, message: "Nothing due." });
  }

  const results = [];

  for (const automation of due) {
    const run = await db.run.create({
      data: { automationId: automation.id, status: "running" },
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
        where: { id: automation.id },
        data: { lastRunAt: new Date(), nextRunAt },
      });

      results.push({ id: automation.id, name: automation.name, ok: result.ok });
    } catch (err) {
      await db.run.update({
        where: { id: run.id },
        data: { status: "failed", result: (err as Error).message, finishedAt: new Date() },
      });
      results.push({ id: automation.id, name: automation.name, ok: false, error: (err as Error).message });
    }
  }

  return Response.json({ ok: true, ran: results.length, results });
}

export async function GET() {
  // Health check — cron-job.org and other services ping this to validate the URL.
  // Returns 200 OK without running any automations.
  return Response.json({ ok: true, message: "TaskPilot cron endpoint is ready." });
}
