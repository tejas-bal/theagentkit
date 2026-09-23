import { NextRequest, NextResponse } from "next/server";
import path from "node:path";

import { getProjectBySlug } from "@/lib/projects";
import { embedQuery } from "@/lib/rag/embeddings";
import { searchIndex } from "@/lib/rag/vectorStore";
import { generateAnswer } from "@/lib/rag/groq";
import { classifyIntent } from "@/lib/intent/classifier";
import { executeDeterministic, loadDataset } from "@/lib/intent/ukConstituencies";

// transformers.js needs native ONNX Runtime bindings, not available on the Edge runtime.
export const runtime = "nodejs";
// A cold start loads ONNX Runtime and downloads the embedding model before the
// first query, which can outlast a short default function timeout.
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const project = getProjectBySlug(slug);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const question = body?.question;

  if (typeof question !== "string" || question.trim() === "") {
    return NextResponse.json({ error: "Missing 'question'" }, { status: 400 });
  }

  try {
    // Route first: questions answerable by counting/filtering/sorting the JSON are
    // answered exactly from the data, with no embedding, retrieval or LLM involved.
    const dataset = loadDataset(project.dir);
    const classification = dataset ? classifyIntent(question, dataset.vocab) : null;

    if (dataset && classification?.intent === "deterministic") {
      const result = executeDeterministic(dataset, classification);
      return NextResponse.json({
        intent: "deterministic",
        kind: classification.kind,
        reason: classification.reason,
        answer: result.answer,
        rows: result.rows,
        totalRows: result.total,
      });
    }

    if (!project.hasRagIndex) {
      return NextResponse.json({ error: "No RAG index found for this project" }, { status: 404 });
    }

    const indexFolder = path.join(process.cwd(), project.dir, "rag", "index");
    const queryEmbedding = await embedQuery(question);
    const results = await searchIndex(indexFolder, queryEmbedding, 5);

    if (results.length === 0) {
      return NextResponse.json({ error: "No relevant results found" }, { status: 404 });
    }

    const context = results.map((r) => `[${r.name}]\n${JSON.stringify(r.entry)}`).join("\n\n");
    const answer = await generateAnswer(question, context);

    return NextResponse.json({
      intent: "probabilistic",
      reason: classification?.reason ?? "this project has no structured dataset to query directly",
      answer,
      sources: results.map((r) => ({ id: r.id, name: r.name, score: r.score })),
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
