import { NextResponse } from "next/server";
import { embed } from "@/lib/ollama";
import { getStore, pageText } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const editable = ["title", "summary", "journal", "people", "food", "places", "healthMentions", "highlights", "difficultMoments", "thingsToRemember"] as const;

export async function GET(_request: Request, ctx: RouteContext<"/api/journal/[id]">) {
  const { id } = await ctx.params;
  const entry = await getStore().get(id);
  return entry ? NextResponse.json({ entry }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/journal/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json() as Partial<JournalEntry>;
  const patch: Partial<JournalEntry> = {};
  for (const key of editable) if (key in body) Object.assign(patch, { [key]: body[key] });
  // `transcript: null` forgets the raw conversation but keeps the page.
  if ((body as { transcript?: unknown }).transcript === null) patch.transcript = undefined;
  const store = getStore();
  const updated = await store.update(id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const embedding = await embed(pageText(updated));
  if (embedding) await store.save({ ...updated, embedding });
  return NextResponse.json({ entry: updated });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/journal/[id]">) {
  const { id } = await ctx.params;
  return (await getStore().remove(id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
