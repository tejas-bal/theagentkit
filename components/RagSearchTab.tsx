"use client";

import { useState } from "react";

interface SearchResult {
  id: string;
  name: string;
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
        Searches the vector database directly — no LLM involved, no summarization: the
        raw top 2 closest documents by embedding similarity, unmodified from the source
        JSON.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
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
          className="rounded-full bg-ink px-6 py-3 text-[15px] font-medium text-white transition disabled:opacity-40"
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
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink">{r.name}</p>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-ink/70">
                  score {r.score.toFixed(3)}
                </span>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-4 text-xs leading-relaxed text-ink/80">
                {JSON.stringify(r.entry, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
