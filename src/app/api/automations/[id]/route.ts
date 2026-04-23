import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/automations/[id]">) {
  const { id } = await ctx.params;
  try {
    const automation = await db.automation.findUnique({
      where: { id },
      include: { runs: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
    if (!automation) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(automation);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/automations/[id]">) {
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const automation = await db.automation.update({
      where: { id },
      data: body,
    });
    return Response.json(automation);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/automations/[id]">) {
  const { id } = await ctx.params;
  try {
    await db.automation.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
