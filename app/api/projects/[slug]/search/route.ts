import { NextRequest, NextResponse } from "next/server";
import path from "node:path";

import { getProjectBySlug } from "@/lib/projects";
import { embedQuery } from "@/lib/rag/embeddings";
import { searchIndex } from "@/lib/rag/vectorStore";

// transformers.js needs native ONNX Runtime bindings, not available on the Edge runtime.
export const runtime = "nodejs";

// Retrieval only -- no LLM call, no Groq dependency. Returns the raw top-matching
// documents from the vector store so the RAG tab can show what retrieval alone
// surfaces, separate from the AI Agent tab's full retrieve-then-generate answer.
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const project = getProjectBySlug(slug);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.hasRagIndex) {
    return NextResponse.json({ error: "No RAG index found for this project" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const query = body?.query;

  if (typeof query !== "string" || query.trim() === "") {
    return NextResponse.json({ error: "Missing 'query'" }, { status: 400 });
  }

  const indexFolder = path.join(process.cwd(), project.dir, "rag", "index");

  try {
    const queryEmbedding = await embedQuery(query);
    const results = await searchIndex(indexFolder, queryEmbedding, 2);
    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
