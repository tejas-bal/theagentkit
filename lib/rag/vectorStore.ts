/**
 * Reads the prebuilt vectra index (built offline via
 * <project>/rag/buildIndex.js) and searches it. Read-only from the app's
 * perspective -- the index itself is built and committed separately.
 *
 * Each stored item's metadata holds both the short text summary that was
 * actually embedded (`text`) and the full original constituency record as a
 * JSON string (vectra's metadata values must be primitives, so it's kept
 * serialized and parsed back out here into `entry`, unmodified).
 */
import { LocalIndex } from "vectra";

export interface RagResult {
  id: string;
  name: string;
  text: string;
  entry: unknown;
  score: number;
}

export async function searchIndex(
  indexFolder: string,
  queryEmbedding: number[],
  topK = 5
): Promise<RagResult[]> {
  const index = new LocalIndex(indexFolder);

  if (!(await index.isIndexCreated())) {
    return [];
  }

  const results = await index.queryItems(queryEmbedding, "", topK);

  return results.map((r) => ({
    id: r.item.id,
    name: String(r.item.metadata.name),
    text: String(r.item.metadata.text),
    entry: JSON.parse(String(r.item.metadata.json)),
    score: r.score,
  }));
}
