"use client";

import { useState } from "react";

interface Source {
  id: string;
  name: string;
  score: number;
}

interface AskTabProps {
  slug: string;
}

export default function AskTab({ slug }: AskTabProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);

    try {
      const res = await fetch(`/api/projects/${slug}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      setAnswer(data.answer);
      setSources(data.sources ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this dataset..."
          className="flex-1 rounded-full border border-black/10 bg-white px-5 py-3 text-[15px] outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="w-full rounded-full bg-ink px-6 py-3 text-[15px] font-medium text-white transition disabled:opacity-40 sm:w-auto"
        >
          {loading ? "Asking..." : "Ask"}
        </button>
      </form>

      {error && (
        <p className="mt-6 rounded-2xl bg-red-50 p-4 text-[15px] text-red-700">{error}</p>
      )}

      {answer && (
        <div className="mt-8">
          <p className="whitespace-pre-wrap text-[17px] leading-relaxed text-ink">{answer}</p>

          {sources.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-muted">Sources</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {sources.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink/70"
                  >
                    {s.name} · {s.score.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
