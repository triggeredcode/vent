#!/usr/bin/env node
// Starts everything VENT needs with one command: `pnpm vent`
//   Ollama (+ models) → local voice server → (optional) Temporal → the app → sample days → browser.
// Flags: --no-seed  --no-open  --port=3000

import { execFile, spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const flags = new Set(process.argv.slice(2));
const port = Number([...flags].find((flag) => flag.startsWith("--port="))?.split("=")[1] ?? 3000);
const appUrl = `http://localhost:${port}`;

const bold = (text) => `\x1b[1m${text}\x1b[0m`;
const step = (text) => console.log(`\n${bold("›")} ${text}`);
const ok = (text) => console.log(`  \x1b[32m✓\x1b[0m ${text}`);
const warn = (text) => console.log(`  \x1b[33m!\x1b[0m ${text}`);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readEnv() {
  const env = {};
  for (const file of [".env", ".env.local"]) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    for (const line of (await readFile(full, "utf8")).split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) env[match[1]] = match[2];
    }
  }
  return env;
}

async function reachable(url, timeout = 1500) {
  try { return (await fetch(url, { signal: AbortSignal.timeout(timeout) })).ok; } catch { return false; }
}
function portOpen(portNumber, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect(portNumber, host);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
  });
}
async function until(check, seconds, label) {
  for (let index = 0; index < seconds * 2; index += 1) { if (await check()) return true; await wait(500); }
  warn(`${label} didn't come up within ${seconds}s`);
  return false;
}
function has(command) {
  return new Promise((resolve) => execFile("which", [command], (error) => resolve(!error)));
}
function background(command, args, logName, extraEnv = {}) {
  const log = openSync(path.join(root, ".vent-data", logName), "a");
  const child = spawn(command, args, { cwd: root, detached: true, stdio: ["ignore", log, log], env: { ...process.env, ...extraEnv } });
  child.unref();
  return child;
}
function run(command, args, options = {}) {
  return new Promise((resolve) => spawn(command, args, { cwd: root, stdio: "inherit", ...options }).on("exit", (code) => resolve(code === 0)));
}

const env = await readEnv();
await import("node:fs/promises").then((fs) => fs.mkdir(path.join(root, ".vent-data"), { recursive: true }));
console.log(bold("\nStarting VENT"));

// 1. Ollama + models
step("Open models (Ollama)");
const ollama = (env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
if (!(await reachable(`${ollama}/api/tags`))) {
  if (!(await has("ollama"))) { warn("Ollama isn't installed. Get it from https://ollama.com, then run pnpm vent again."); process.exit(1); }
  if (process.platform === "darwin" && existsSync("/Applications/Ollama.app")) spawn("open", ["-a", "Ollama"]);
  else background("ollama", ["serve"], "ollama.log");
  await until(() => reachable(`${ollama}/api/tags`), 30, "Ollama");
}
const models = [env.OLLAMA_VOICE_MODEL ?? "gemma4:e2b", env.OLLAMA_LISTENER_MODEL ?? "gemma4:e4b", env.OLLAMA_JOURNAL_MODEL ?? "gemma4:e4b", env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text"];
const installed = new Set(((await (await fetch(`${ollama}/api/tags`)).json()).models ?? []).flatMap((model) => [model.name, model.model]));
for (const model of [...new Set(models)]) {
  if (installed.has(model) || installed.has(`${model}:latest`)) { ok(model); continue; }
  console.log(`  pulling ${model} (first run only)…`);
  await run("ollama", ["pull", model]);
}

// 2. Voice server
step("VENT's voice (local)");
const voiceUrl = (env.VENT_TTS_BASE_URL ?? "http://127.0.0.1:8880").replace(/\/$/, "");
if (env.VENT_VOICE_PROVIDER === "elevenlabs") ok("Using ElevenLabs (local voice server still starts as a fallback)");
if (await reachable(`${voiceUrl}/health`)) ok("already running");
else if (await has("uv")) {
  console.log("  starting (first run installs the voice model, a few minutes)…");
  await run("bash", ["voice/start.sh", "--bg"]);
} else warn("uv isn't installed (https://docs.astral.sh/uv/) — VENT will fall back to your browser's voice.");

// 3. Temporal: journal pages are written by a durable workflow
const temporalAddress = (env.TEMPORAL_ADDRESS ?? "localhost:7233").trim();
if (temporalAddress.toLowerCase() !== "off") {
  step("Temporal (durable journal writing)");
  const [host, rawPort] = temporalAddress.split(":");
  const temporalPort = Number(rawPort ?? 7233);
  const temporalHost = host === "localhost" ? "127.0.0.1" : host;
  if (!(await portOpen(temporalPort, temporalHost))) {
    if (!(await has("temporal")) && await has("brew")) {
      console.log("  installing the Temporal CLI (first run only)…");
      await run("brew", ["install", "temporal"]);
    }
    if (await has("temporal")) {
      background("temporal", ["server", "start-dev", "--db-filename", path.join(root, ".vent-data", "temporal.db")], "temporal.log");
      await until(() => portOpen(temporalPort, temporalHost), 30, "Temporal");
    } else warn("Temporal CLI not found (https://docs.temporal.io/cli) — pages are written directly until it's installed.");
  }
  if (await portOpen(temporalPort, temporalHost)) {
    background("pnpm", ["worker"], "worker.log");
    ok("dev server + worker running · UI at http://localhost:8233");
  }
}

// 4. The app
step(`The app → ${appUrl}`);
if (await portOpen(port)) {
  ok(`something is already serving port ${port} — opening it`);
} else {
  const app = spawn("pnpm", ["dev", "--port", String(port)], { cwd: root, stdio: "inherit" });
  process.on("SIGINT", () => { app.kill("SIGINT"); process.exit(0); });
  await until(() => reachable(`${appUrl}/api/journal`, 5000), 90, "The app");
}

// 5. Sample days on a fresh install
if (!flags.has("--no-seed")) {
  try {
    const { entries } = await (await fetch(`${appUrl}/api/journal`)).json();
    if (!entries?.length) { await run("node", ["scripts/seed.mjs"], { env: { ...process.env, VENT_URL: appUrl } }); ok("loaded sample days"); }
  } catch { /* the app will show an empty journal */ }
}

if (!flags.has("--no-open")) spawn(process.platform === "darwin" ? "open" : "xdg-open", [appUrl]);
console.log(`\n${bold("VENT is ready")} → ${appUrl}   ${"\x1b[2m"}(partners: pnpm connect · stop: Ctrl+C)${"\x1b[0m"}\n`);
