// Loads the sample days into a running VENT server: `pnpm seed` (server must be running).
import { readFile } from "node:fs/promises";

const base = process.env.VENT_URL ?? "http://localhost:3000";
const entries = JSON.parse(await readFile(new URL("./seed-entries.json", import.meta.url), "utf8"));
const response = await fetch(`${base}/api/journal/import`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ entries }),
});
console.log(response.ok ? await response.json() : `Seeding failed: ${response.status} ${await response.text()}`);
