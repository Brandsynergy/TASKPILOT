import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const listName = new URL(req.url).searchParams.get("list") ?? undefined;
  try {
    const contacts = await db.contact.findMany({
      where: listName ? { listName } : undefined,
      orderBy: { createdAt: "asc" },
    });
    return Response.json(contacts);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, listName, extraJson } = body;
    if (!name?.trim()) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    const contact = await db.contact.create({
      data: {
        name: name.trim(),
        email: email?.trim() ?? null,
        phone: phone?.trim() ?? null,
        listName: listName?.trim() ?? "default",
        extraJson: extraJson ? JSON.stringify(extraJson) : null,
      },
    });
    return Response.json(contact, { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  try {
    await db.contact.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
