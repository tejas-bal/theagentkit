/**
 * Local query embeddings via transformers.js -- runs in this Node process, no
 * external API. Must match the model used to build the index
 * (uk-parliament-project/rag/embeddings.js) or scores will be meaningless.
 */
import os from "node:os";
import path from "node:path";
import { env, pipeline } from "@huggingface/transformers";

// transformers.js caches downloaded model files next to its own install
// (node_modules/@huggingface/transformers/.cache) by default. On Vercel the
// deployed function's filesystem is read-only apart from /tmp, so the first
// download fails with EROFS -- point the cache at the OS temp dir there.
if (process.env.VERCEL) {
  env.cacheDir = path.join(os.tmpdir(), "transformers-cache");
}

const MODEL_NAME = process.env.EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorPromise: Promise<any> | null = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_NAME);
  }
  return extractorPromise;
}

export async function embedQuery(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}
