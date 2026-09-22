/**
 * Reads the prebuilt vectra index (built offline via
 * <project>/rag/buildIndex.js) and searches it. Read-only from the app's
 * perspective -- the index itself is built and committed separately.
 */
import { LocalIndex } from "vectra";

export interface RagResult {
  id: string;
  name: string;
  text: string;
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
    score: r.score,
  }));
}
