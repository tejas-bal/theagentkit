"use client";

import { useState } from "react";

interface SearchResult {
  id: string;
  name: string;
  text: string;
  entry: unknown;
  score: number;
}

interface RagSearchTabProps {
  slug: string;
}

export default function RagSearchTab({ slug }: RagSearchTabProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch(`/api/projects/${slug}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="mb-6 text-sm text-muted">
        Searches the vector database directly — no LLM involved: the top 2 closest
        documents by embedding similarity, shown as the exact text that was stored and
        embedded for each match, plus the full source record it came from.
      </p>

      <details className="mb-8 rounded-2xl bg-paper p-6 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <summary className="cursor-pointer select-none font-semibold text-ink">
          How this RAG pipeline is built
        </summary>

        <div className="mt-4 space-y-5 text-ink/80">
          <div>
            <p className="font-medium text-ink">1. Indexing (offline, committed to the repo)</p>
            <p className="mt-1 leading-relaxed">
              Each raw record in{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs">output/*.json</code> is
              turned into a document with two separate representations: a short 3–4 sentence
              natural-language summary used only as the embedding input, and the full,
              unmodified original record kept as metadata for retrieval. Embedding the raw JSON
              directly was tried first and measurably hurt retrieval — the model is trained on
              English sentences, not JSON syntax, and every record shared identical structural
              keys that ate into the embedding&apos;s fixed token budget without differentiating
              anything.
            </p>
          </div>

          <div>
            <p className="font-medium text-ink">2. Embeddings</p>
            <p className="mt-1 leading-relaxed">
              Generated locally with{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs">
                @huggingface/transformers
              </code>{" "}
              (transformers.js) running the{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs">
                Xenova/all-MiniLM-L6-v2
              </code>{" "}
              sentence-embedding model — no external embedding API, no per-call cost. Mean-pooled
              and normalized to unit vectors. The same model runs at query time (in this box) and
              at index-build time, since the two embeddings only compare meaningfully if they
              come from an identical model and pooling strategy.
            </p>
          </div>

          <div>
            <p className="font-medium text-ink">3. Vector store</p>
            <p className="mt-1 leading-relaxed">
              <code className="rounded bg-white px-1.5 py-0.5 text-xs">vectra</code>, a small
              file-backed local vector index (no external vector DB or hosted service). It&apos;s
              built once offline via a{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs">buildIndex.js</code>{" "}
              script (resumable — already-embedded records are skipped on rerun) and the
              resulting index files are committed to the repo, so the deployed app only ever
              reads from it.
            </p>
          </div>

          <div>
            <p className="font-medium text-ink">4. Query time (this tab)</p>
            <p className="mt-1 leading-relaxed">
              Your query text is embedded with the same model, then matched against the index
              with vectra&apos;s cosine-similarity search. The API route runs on the Next.js
              Node.js runtime rather than the Edge runtime, since local embeddings need native
              ONNX Runtime bindings. This tab stops right there and returns the top 2 raw matches
              — no generation step, so it also works without a Groq API key. The <b>AI Agent</b>{" "}
              tab runs the same retrieval, then sends the matched context plus your question to
              Groq&apos;s OpenAI-compatible chat completions API to generate a grounded answer.
            </p>
          </div>
        </div>
      </details>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the vector database..."
          className="flex-1 rounded-full border border-black/10 bg-white px-5 py-3 text-[15px] outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="w-full rounded-full bg-ink px-6 py-3 text-[15px] font-medium text-white transition disabled:opacity-40 sm:w-auto"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-2xl bg-red-50 p-4 text-[15px] text-red-700">{error}</p>
      )}

      {results && (
        <div className="mt-8 space-y-4">
          {results.length === 0 && <p className="text-muted">No matching documents found.</p>}
          {results.map((r) => (
            <div key={r.id} className="rounded-2xl bg-paper p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">{r.name}</p>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-ink/70">
                  score {r.score.toFixed(3)}
                </span>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-ink/80">{r.text}</p>

              <details className="mt-3">
                <summary className="cursor-pointer select-none text-xs font-medium text-muted">
                  View full source record
                </summary>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-4 text-xs leading-relaxed text-ink/80">
                  {JSON.stringify(r.entry, null, 2)}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
