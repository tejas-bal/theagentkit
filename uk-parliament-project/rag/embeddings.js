/**
 * Local embeddings via transformers.js (@huggingface/transformers) -- runs entirely
 * in this Node process, no external API, no rate limits or quota. The model
 * downloads once on first use (cached under ~/.cache/huggingface) and every run
 * after that is fully offline.
 */
import { pipeline } from "@huggingface/transformers";

const MODEL_NAME = process.env.EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2";
const BATCH_SIZE = 32;

let extractorPromise = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_NAME);
  }
  return extractorPromise;
}

function chunk(items, size) {
  const batches = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/** Embed a list of texts, returning a list of embedding vectors (same order). */
export async function embedTexts(texts, { batchSize = BATCH_SIZE } = {}) {
  const extractor = await getExtractor();
  const vectors = [];

  for (const batch of chunk(texts, batchSize)) {
    const output = await extractor(batch, { pooling: "mean", normalize: true });
    vectors.push(...output.tolist());
  }

  return vectors;
}

/** Embed a single query string. */
export async function embedQuery(text) {
  const [vector] = await embedTexts([text], { batchSize: 1 });
  return vector;
}

export { MODEL_NAME };
