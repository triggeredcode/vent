/**
 * Temporal worker for VENT's durable journal pipeline (optional).
 *   temporal server start-dev      # Temporal dev server + UI on http://localhost:8233
 *   pnpm worker                    # this file
 * The app uses localhost:7233 by default (TEMPORAL_ADDRESS overrides it; "off" disables Temporal).
 */
import path from "node:path";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "../src/temporal/activities";
import { TASK_QUEUE } from "../src/temporal/shared";

// Same env files as Next (.env.local wins; real environment variables win over both).
for (const file of [".env.local", ".env"]) {
  try { process.loadEnvFile(file); } catch { /* optional */ }
}

async function main() {
  const address = process.env.TEMPORAL_ADDRESS?.trim() || "localhost:7233";
  const connection = await NativeConnection.connect({ address });
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
    taskQueue: TASK_QUEUE,
    workflowsPath: path.resolve(process.cwd(), "src/temporal/workflows.ts"),
    activities,
  });
  console.log(`VENT worker polling "${TASK_QUEUE}" on ${address} (Ollama: ${process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"})`);
  await worker.run();
  await connection.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
