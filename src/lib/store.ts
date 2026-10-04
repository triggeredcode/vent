import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { MongoClient, type Collection } from "mongodb";
import type { JournalEntry } from "./types";

export interface StoredEntry extends JournalEntry {
  embedding?: number[];
}

export interface JournalStore {
  readonly kind: "local" | "atlas";
  list(): Promise<JournalEntry[]>;
  get(id: string): Promise<JournalEntry | undefined>;
  save(entry: StoredEntry): Promise<void>;
  update(id: string, patch: Partial<JournalEntry>): Promise<JournalEntry | undefined>;
  remove(id: string): Promise<boolean>;
  /** Pages closest in meaning to the query embedding. */
  nearest(embedding: number[], limit: number): Promise<JournalEntry[]>;
}

const byDateDesc = (a: JournalEntry, b: JournalEntry) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
const strip = (stored: StoredEntry): JournalEntry => {
  const entry = { ...stored };
  delete entry.embedding;
  return entry;
};

function cosine(a: number[], b: number[]) {
  let dot = 0, normA = 0, normB = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    dot += a[index] * b[index]; normA += a[index] ** 2; normB += b[index] ** 2;
  }
  return dot / (Math.sqrt(normA * normB) || 1);
}

/** Default store: one JSON file on this machine. Nothing leaves the device. */
class LocalJournalStore implements JournalStore {
  readonly kind = "local" as const;
  private file = path.resolve(process.env.VENT_DATA_DIR ?? ".vent-data", "journal.json");
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<StoredEntry[]> {
    try { return JSON.parse(await readFile(this.file, "utf8")) as StoredEntry[]; } catch { return []; }
  }

  private write(mutate: (entries: StoredEntry[]) => StoredEntry[]) {
    const next = this.queue.then(async () => {
      const entries = mutate(await this.read());
      await mkdir(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.tmp`;
      await writeFile(temp, JSON.stringify(entries, null, 2));
      await rename(temp, this.file);
      return entries;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  async list() { return (await this.read()).map(strip).sort(byDateDesc); }
  async get(id: string) { const found = (await this.read()).find((entry) => entry.id === id); return found && strip(found); }
  async save(entry: StoredEntry) { await this.write((entries) => [...entries.filter((item) => item.id !== entry.id), entry]); }
  async update(id: string, patch: Partial<JournalEntry>) {
    let updated: StoredEntry | undefined;
    await this.write((entries) => entries.map((entry) => entry.id === id ? (updated = { ...entry, ...patch, id }) : entry));
    return updated && strip(updated);
  }
  async remove(id: string) {
    let removed = false;
    await this.write((entries) => entries.filter((entry) => entry.id === id ? !(removed = true) : true));
    return removed;
  }
  async nearest(embedding: number[], limit: number) {
    return (await this.read())
      .filter((entry) => entry.embedding?.length)
      .map((entry) => ({ entry, score: cosine(embedding, entry.embedding!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry }) => strip(entry));
  }
}

/**
 * MongoDB Atlas store: the same pages, synced, with Atlas Vector Search over
 * embeddings computed locally by an open embedding model.
 */
class AtlasJournalStore implements JournalStore {
  readonly kind = "atlas" as const;
  private collection: Promise<Collection<StoredEntry>>;
  private indexName = "vent_entry_embedding";

  constructor(uri: string) {
    this.collection = (async () => {
      const client = await new MongoClient(uri, { appName: "vent" }).connect();
      const collection = client.db(process.env.MONGODB_DB ?? "vent").collection<StoredEntry>("entries");
      await collection.createIndex({ id: 1 }, { unique: true });
      await collection.createIndex({ date: -1 });
      void this.ensureVectorIndex(collection);
      return collection;
    })();
  }

  private async ensureVectorIndex(collection: Collection<StoredEntry>) {
    try {
      const existing = await collection.listSearchIndexes(this.indexName).toArray();
      if (existing.length) return;
      await collection.createSearchIndex({
        name: this.indexName,
        type: "vectorSearch",
        definition: { fields: [{ type: "vector", path: "embedding", numDimensions: Number(process.env.VENT_EMBED_DIMENSIONS ?? 768), similarity: "cosine" }] },
      });
    } catch (error) {
      console.warn("[vent] Atlas Vector Search index unavailable:", error instanceof Error ? error.message : error);
    }
  }

  private async entries() { return this.collection; }

  async list() {
    const collection = await this.entries();
    return collection.find({}, { projection: { _id: 0, embedding: 0 } }).sort({ date: -1, createdAt: -1 }).toArray();
  }
  async get(id: string) {
    const collection = await this.entries();
    return (await collection.findOne({ id }, { projection: { _id: 0, embedding: 0 } })) ?? undefined;
  }
  async save(entry: StoredEntry) {
    const collection = await this.entries();
    await collection.replaceOne({ id: entry.id }, entry, { upsert: true });
  }
  async update(id: string, patch: Partial<JournalEntry>) {
    const collection = await this.entries();
    const fields = { ...patch };
    delete fields.id;
    const updated = await collection.findOneAndUpdate({ id }, { $set: fields }, { returnDocument: "after", projection: { _id: 0, embedding: 0 } });
    return updated ?? undefined;
  }
  async remove(id: string) {
    const collection = await this.entries();
    return (await collection.deleteOne({ id })).deletedCount === 1;
  }
  async nearest(embedding: number[], limit: number) {
    const collection = await this.entries();
    try {
      return await collection.aggregate<JournalEntry>([
        { $vectorSearch: { index: this.indexName, path: "embedding", queryVector: embedding, numCandidates: Math.max(50, limit * 10), limit } },
        { $project: { _id: 0, embedding: 0 } },
      ]).toArray();
    } catch {
      return [];
    }
  }
}

const globalStore = globalThis as typeof globalThis & { __ventStore?: JournalStore };

export function getStore(): JournalStore {
  globalStore.__ventStore ??= process.env.MONGODB_URI ? new AtlasJournalStore(process.env.MONGODB_URI) : new LocalJournalStore();
  return globalStore.__ventStore;
}

/** The text used for embeddings and memory answers — never includes the raw transcript. */
export function pageText(entry: JournalEntry) {
  return [
    `${entry.displayDate}: ${entry.title}. Mood ${entry.mood.label}.`,
    entry.summary,
    entry.people.length ? `People: ${entry.people.join(", ")}.` : "",
    entry.food.length ? `Food: ${entry.food.join(", ")}.` : "",
    entry.places.length ? `Places: ${entry.places.join(", ")}.` : "",
    entry.highlights.length ? `Highlights: ${entry.highlights.join("; ")}.` : "",
    entry.difficultMoments.length ? `Hard moments: ${entry.difficultMoments.join("; ")}.` : "",
    entry.healthMentions.length ? `Health: ${entry.healthMentions.join(", ")}.` : "",
    entry.thingsToRemember.length ? `To remember: ${entry.thingsToRemember.join("; ")}.` : "",
    entry.moodArc.length ? `Mood arc: ${entry.moodArc.map((point) => `${point.phase} ${point.label}`).join(" → ")}.` : "",
  ].filter(Boolean).join(" ");
}
