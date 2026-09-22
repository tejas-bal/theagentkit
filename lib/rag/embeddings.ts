/**
 * Local query embeddings via transformers.js -- runs in this Node process, no
 * external API. Must match the model used to build the index
 * (uk-parliament-project/rag/embeddings.js) or scores will be meaningless.
 */
import { pipeline } from "@huggingface/transformers";

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
