/**
 * Reads the prebuilt vectra index (built offline via
 * <project>/rag/buildIndex.js) and searches it. Read-only from the app's
 * perspective -- the index itself is built and committed separately.
 *
 * Each stored item's metadata holds the full original constituency record as a
 * JSON string (vectra's metadata values must be primitives) -- parsed back out
 * here into `entry`, unmodified from output/uk_constituencies.json.
 */
import { LocalIndex } from "vectra";

export interface RagResult {
  id: string;
  name: string;
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
    entry: JSON.parse(String(r.item.metadata.json)),
    score: r.score,
  }));
}
