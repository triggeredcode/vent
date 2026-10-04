import { NextResponse } from "next/server";
import { audioModel, getVoiceStatus, listenerModel } from "@/lib/ollama";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getVoiceStatus();
  return NextResponse.json({ ...status, audioModel: audioModel(), listenerModel: listenerModel() }, { status: status.ready ? 200 : 503 });
}
