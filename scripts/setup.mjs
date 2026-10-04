#!/usr/bin/env node
// One-command partner setup: `pnpm connect`
// Walks through Sentry (tracing) and ElevenLabs (your cloned voice + generated sound effects),
// verifies each key for real, and writes everything into .env.local.
// Non-interactive: pnpm connect --sentry-dsn=<dsn> --elevenlabs-key=<key> [--yes]

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const envFile = path.join(root, ".env.local");
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.length ? rest.join("=") : true];
}));
const assumeYes = Boolean(args.yes);
const rl = createInterface({ input: process.stdin, output: process.stdout });

const bold = (text) => `\x1b[1m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const dim = (text) => `\x1b[2m${text}\x1b[0m`;
const ok = (text) => console.log(`  ${green("✓")} ${text}`);
const fail = (text) => console.log(`  ${red("✗")} ${text}`);
const openUrl = (url) => execFile(process.platform === "darwin" ? "open" : "xdg-open", [url], () => undefined);

let inputClosed = false;
const closed = new Promise((resolve) => rl.once("close", () => { inputClosed = true; resolve(""); }));

async function ask(question, fallback = "") {
  if (assumeYes || inputClosed) return fallback;
  const answer = String(await Promise.race([rl.question(`  ${question} `), closed])).trim();
  return answer || fallback;
}
async function confirm(question, fallback = true) {
  const answer = (await ask(`${question} ${fallback ? "[Y/n]" : "[y/N]"}`, inputClosed ? "n" : fallback ? "y" : "n")).toLowerCase();
  return answer.startsWith("y");
}

async function readEnv() {
  const values = new Map();
  if (!existsSync(envFile)) return values;
  for (const line of (await readFile(envFile, "utf8")).split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

async function writeEnv(updates) {
  const existing = existsSync(envFile) ? await readFile(envFile, "utf8") : "";
  const lines = existing.split("\n").filter((line, index, all) => !(index === all.length - 1 && line === ""));
  for (const [key, value] of Object.entries(updates)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  await writeFile(envFile, `${lines.join("\n")}\n`);
}

// ── Sentry ──────────────────────────────────────────────────────────

function parseDsn(dsn) {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/\//g, "");
    if (!url.username || !projectId) return null;
    return { key: url.username, host: url.host, protocol: url.protocol, projectId };
  } catch {
    return null;
  }
}

/** Sends one real event straight to Sentry's envelope endpoint, so you can see it arrive. */
async function sendSentryTest(dsn) {
  const parsed = parseDsn(dsn);
  if (!parsed) return false;
  const eventId = randomBytes(16).toString("hex");
  const sentAt = new Date().toISOString();
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: sentAt, dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify({ event_id: eventId, timestamp: Date.now() / 1000, platform: "javascript", level: "info", message: "VENT is connected to Sentry 🎉 (setup test)", tags: { source: "pnpm connect" } }),
  ].join("\n");
  const response = await fetch(`${parsed.protocol}//${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${parsed.key}&sentry_version=7`, {
    method: "POST",
    headers: { "content-type": "application/x-sentry-envelope" },
    body,
  }).catch(() => null);
  return Boolean(response?.ok);
}

async function setupSentry(env) {
  console.log(`\n${bold("1 · Sentry")} ${dim("— traces every call turn: transcribe → listen → speak, with timings and tokens (never content)")}`);
  let dsn = typeof args["sentry-dsn"] === "string" ? args["sentry-dsn"] : "";
  if (!dsn && env.get("SENTRY_DSN") && !(await confirm(`Sentry is already set up. Replace it?`, false))) {
    ok("Keeping your existing Sentry DSN");
    return {};
  }
  if (!dsn) {
    if (!(await confirm("Set up Sentry now?"))) return {};
    console.log(dim("    1. Sign up / log in (free).  2. Create a project → platform: Next.js.  3. Copy the DSN it shows you."));
    console.log(dim("       Already have a project? Settings → Projects → <project> → Client Keys (DSN)."));
    if (await confirm("Open Sentry in your browser?")) openUrl("https://sentry.io/signup/");
    dsn = await ask("Paste your DSN (https://…@….ingest.sentry.io/…):");
  }
  if (!parseDsn(dsn)) { fail("That doesn't look like a Sentry DSN — skipping."); return {}; }
  if (await sendSentryTest(dsn)) ok("Sentry received a test event — look for “VENT is connected to Sentry” under Issues");
  else fail("Couldn't reach Sentry with that DSN (saved anyway — double-check it in Sentry).");
  return { SENTRY_DSN: dsn, SENTRY_ENVIRONMENT: "local" };
}

// ── ElevenLabs ──────────────────────────────────────────────────────

const ELEVEN = "https://api.elevenlabs.io/v1";

const soundEffects = [
  ["punch-1.mp3", "Heavy leather boxing glove punch hitting a heavy punching bag, deep thud, close mic, dry, no music", 0.6],
  ["punch-2.mp3", "Boxer's hard cross punch slamming into a heavy bag, punchy low thump with leather slap, dry studio", 0.6],
  ["punch-3.mp3", "Quick jab hitting a heavy punching bag in a gym, tight leather smack, dry, no reverb", 0.5],
  ["uppercut.mp3", "Massive uppercut into a heavy punching bag, huge deep boom, bag chains rattle, cinematic impact", 1.0],
  ["bag-burst.mp3", "Heavy punching bag tears open and bursts, leather rips, sand pours out onto the floor", 1.8],
  ["bell.mp3", "Boxing ring bell ringing twice, ding ding, end of round", 1.6],
  ["chain.mp3", "Metal chain clanking as a heavy punching bag is hung on a hook", 1.0],
  ["whoosh.mp3", "Fast boxing glove swing whoosh through the air, short, no impact", 0.5],
];

async function eleven(pathname, init = {}, key) {
  return fetch(`${ELEVEN}${pathname}`, { ...init, headers: { "xi-api-key": key, ...(init.headers ?? {}) } });
}

async function setupElevenLabs(env) {
  console.log(`\n${bold("2 · ElevenLabs")} ${dim("— VENT speaks in your cloned voice, and the punch mode gets studio sound effects")}`);
  let key = typeof args["elevenlabs-key"] === "string" ? args["elevenlabs-key"] : "";
  if (!key && env.get("ELEVENLABS_API_KEY") && !(await confirm("ElevenLabs is already set up. Replace the key?", false))) key = env.get("ELEVENLABS_API_KEY");
  if (!key) {
    if (!(await confirm("Set up ElevenLabs now?"))) return {};
    console.log(dim("    Log in → Profile (bottom left) → API Keys → Create key (enable Text to Speech, Voices, Sound Effects)."));
    if (await confirm("Open the ElevenLabs API keys page?")) openUrl("https://elevenlabs.io/app/settings/api-keys");
    key = await ask("Paste your ElevenLabs API key:");
  }
  if (!key) return {};

  const userResponse = await eleven("/user", {}, key);
  if (!userResponse.ok) { fail(`ElevenLabs rejected that key (${userResponse.status}).`); return {}; }
  const user = await userResponse.json();
  const sub = user.subscription ?? {};
  ok(`Connected — plan: ${sub.tier ?? "?"}, characters left: ${sub.character_limit && sub.character_count != null ? sub.character_limit - sub.character_count : "?"}`);
  const updates = { ELEVENLABS_API_KEY: key, ELEVENLABS_MODEL: "eleven_flash_v2_5" };

  // Your voice: an Instant Voice Clone made from your own (consented) recording.
  const reference = ["voice/voices/owner-script.wav", "voice/voices/owner.wav"].map((file) => path.join(root, file)).find(existsSync);
  let voiceId = env.get("ELEVENLABS_VOICE_ID") ?? "";
  const wantsClone = reference && (voiceId
    ? await confirm("Re-create your ElevenLabs voice from your recording?", false)
    : await confirm(`Clone your voice on ElevenLabs from ${path.relative(root, reference)}?`));
  if (wantsClone) {
    const form = new FormData();
    form.append("name", "VENT — my voice");
    form.append("description", "Created by VENT setup from the owner's own consented recording.");
    form.append("remove_background_noise", "true");
    form.append("files", new Blob([await readFile(reference)], { type: "audio/wav" }), path.basename(reference));
    const response = await eleven("/voices/add", { method: "POST", body: form }, key);
    if (response.ok) { voiceId = (await response.json()).voice_id; ok(`Your voice is ready on ElevenLabs (voice id ${voiceId})`); }
    else fail(`Voice cloning failed (${response.status}): ${(await response.text()).slice(0, 160)}`);
  } else if (!reference) {
    console.log(dim("    No voice recording found (run ./voice/record.sh to make one). Using a calm ElevenLabs voice instead."));
  }
  if (voiceId) updates.ELEVENLABS_VOICE_ID = voiceId;

  // Sound effects for the punch mode, generated once and saved into public/sfx.
  if (await confirm("Generate the punch-mode sound effects with ElevenLabs? (~8 short clips)")) {
    const dir = path.join(root, "public", "sfx");
    await mkdir(dir, { recursive: true });
    for (const [file, text, seconds] of soundEffects) {
      const response = await eleven("/sound-generation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: 0.6 }),
      }, key);
      if (!response.ok) { fail(`${file}: ${response.status} ${(await response.text()).slice(0, 120)}`); continue; }
      await writeFile(path.join(dir, file), Buffer.from(await response.arrayBuffer()));
      ok(`public/sfx/${file}`);
    }
  }

  if (await confirm("Make ElevenLabs VENT's voice now? (No = keep the fully local voice; you can switch any time)")) updates.VENT_VOICE_PROVIDER = "elevenlabs";
  else updates.VENT_VOICE_PROVIDER = "local";
  return updates;
}

// ── main ────────────────────────────────────────────────────────────

console.log(bold("\nVENT setup") + dim("  — everything stays optional; skip anything with Enter/n.\n"));
const env = await readEnv();
const updates = { ...(await setupSentry(env)), ...(await setupElevenLabs(env)) };
rl.close();
if (Object.keys(updates).length) {
  await writeEnv(updates);
  ok(`Saved ${Object.keys(updates).length} setting(s) to .env.local`);
}
console.log(`\n${bold("Next:")} restart the app so it picks these up →  ${bold("pnpm vent")}\n`);
