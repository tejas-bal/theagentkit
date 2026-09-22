#!/usr/bin/env node
/**
 * Query the RAG pipeline: embeds a question locally with transformers.js and
 * searches the vectra-backed vector store built by buildIndex.js.
 *
 * Usage:
 *   node query.js "Who is the MP for Aldershot?"
 *   node query.js "Which constituencies did Labour hold in 2024?" --top-k 8
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { embedQuery } from "./embeddings.js";
import { VectorStore } from "./vectorStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { topK: 5, index: path.join(__dirname, "index"), question: null };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--top-k") {
      args.topK = parseInt(argv[++i], 10);
    } else if (argv[i] === "--index") {
      args.index = argv[++i];
    } else {
      positional.push(argv[i]);
    }
  }

  args.question = positional[0] ?? null;
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.question) {
    console.error('Usage: node query.js "<question>" [--top-k N] [--index folder]');
    process.exit(1);
  }

  if (!fs.existsSync(args.index)) {
    console.error(`Index not found at ${args.index}. Run buildIndex.js first.`);
    process.exit(1);
  }

  const store = new VectorStore(args.index);
  const queryEmbedding = await embedQuery(args.question);
  const results = await store.search(queryEmbedding, args.topK);

  if (results.length === 0) {
    console.log("No relevant constituencies found for that question.");
    return;
  }

  for (const r of results) {
    console.log(`[${r.score.toFixed(4)}] ${r.name} (id=${r.id})`);
    console.log(`  ${r.text}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
