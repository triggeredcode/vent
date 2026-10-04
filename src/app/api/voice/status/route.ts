import { NextResponse } from "next/server";
import { getModelStatus, journalModel, listenerModel, voiceModel } from "@/lib/ollama";
import { voiceStatus } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode");
  const [models, voice] = await Promise.all([getModelStatus(mode === "vent" || mode === "journal" ? mode : undefined), voiceStatus()]);
  return NextResponse.json(
    { ...models, voice, voiceModel: voiceModel(), listenerModel: listenerModel(), journalModel: journalModel() },
    { status: models.ready ? 200 : 503 },
  );
}
