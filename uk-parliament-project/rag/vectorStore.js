/**
 * In-memory/file-backed vector store, backed by vectra's LocalIndex: no external
 * DB/service, just a JSON file on disk (one folder per index) that's loaded into
 * memory and searched by cosine similarity. Persistence, similarity search, and
 * metadata storage are all handled by the library -- this is a thin wrapper that
 * adapts it to the {id, name, json, embedding} shape the rest of this pipeline uses.
 *
 * vectra's metadata values must be primitives (string/number/boolean), so the full
 * record is kept as its JSON-serialized string and parsed back out on search --
 * still the exact original object, round-tripped losslessly.
 */
import { LocalIndex } from "vectra";

export class VectorStore {
  constructor(folderPath) {
    this.index = new LocalIndex(folderPath);
  }

  async _ensureCreated() {
    if (!(await this.index.isIndexCreated())) {
      await this.index.createIndex();
    }
  }

  /** IDs of records already in the store (for skipping already-embedded documents). */
  async existingIds() {
    await this._ensureCreated();
    const items = await this.index.listItems();
    return new Set(items.map((item) => item.id));
  }

  /** Add records: [{ id, name, json, embedding }, ...]. Persists immediately. */
  async add(records) {
    await this._ensureCreated();
    await this.index.batchInsertItems(
      records.map((r) => ({
        id: String(r.id),
        vector: r.embedding,
        metadata: { name: r.name, json: r.json },
      }))
    );
  }

  async search(queryEmbedding, topK = 5) {
    await this._ensureCreated();
    const results = await this.index.queryItems(queryEmbedding, "", topK);
    return results.map((r) => ({
      id: r.item.id,
      name: r.item.metadata.name,
      entry: JSON.parse(r.item.metadata.json),
      score: r.score,
    }));
  }
}
