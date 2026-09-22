#!/usr/bin/env node
/**
 * Build the vector index for the RAG pipeline: embeds every constituency document
 * locally with transformers.js and stores the vectors in a vectra LocalIndex under
 * rag/index/.
 *
 * Resumable: if the index already has embeddings for some constituencies, those
 * are skipped -- only missing documents are (re-)embedded.
 *
 * Usage:
 *   npm install
 *   node buildIndex.js [inputJson] [indexFolder]
 *
 *   inputJson   defaults to ../output/uk_constituencies.json
 *   indexFolder defaults to ./index
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildDocument } from "./documents.js";
import { embedTexts, MODEL_NAME } from "./embeddings.js";
import { VectorStore } from "./vectorStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const inputPath = process.argv[2] || path.join(__dirname, "..", "output", "uk_constituencies.json");
  const indexFolder = process.argv[3] || path.join(__dirname, "index");

  const entries = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const documents = entries.map(buildDocument);

  const store = new VectorStore(indexFolder);
  const alreadyDone = await store.existingIds();
  const todo = documents.filter((d) => !alreadyDone.has(String(d.id)));

  if (todo.length === 0) {
    console.log(`All ${documents.length} constituencies already embedded in ${indexFolder}. Nothing to do.`);
    return;
  }

  console.log(`${alreadyDone.size}/${documents.length} already embedded, ${todo.length} remaining.`);
  console.log(`Embedding locally with transformers.js (${MODEL_NAME})...`);

  const vectors = await embedTexts(todo.map((d) => d.text));
  await store.add(todo.map((doc, i) => ({ ...doc, embedding: vectors[i] })));

  console.log(`Done: ${documents.length} constituencies embedded -> ${indexFolder}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
