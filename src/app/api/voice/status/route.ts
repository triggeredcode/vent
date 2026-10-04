import { NextResponse } from "next/server";
import { getModelStatus, journalModel, listenerModel, voiceModel } from "@/lib/ollama";
import { asFlavor, voiceStatus } from "@/lib/voice";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = params.get("mode");
  const flavor = asFlavor(params.get("flavor"));
  const [models, voice] = await Promise.all([getModelStatus(mode === "vent" || mode === "journal" ? mode : undefined, flavor), voiceStatus()]);
  return NextResponse.json(
    { ...models, voice, voiceModel: voiceModel(), listenerModel: listenerModel(), journalModel: journalModel() },
    { status: models.ready ? 200 : 503 },
  );
}
