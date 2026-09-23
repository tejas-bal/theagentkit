"use client";

import { useState } from "react";
import { postJson } from "@/lib/postJson";
import ExampleQuestions from "./ExampleQuestions";

interface Source {
  id: string;
  name: string;
  score: number;
}

type Row = Record<string, string | number>;

interface Meta {
  intent: "deterministic" | "probabilistic";
  reason: string;
  rows: Row[];
  totalRows: number;
}

const PREVIEW_ROWS = 10;

interface AskTabProps {
  slug: string;
  exampleQuestions?: string[];
}

export default function AskTab({ slug, exampleQuestions = [] }: AskTabProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(question);
  }

  function handleExample(q: string) {
    setQuestion(q);
    ask(q);
  }

  async function ask(question: string) {
    if (!question.trim() || loading) return;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    setMeta(null);

    try {
      const data = await postJson<{ answer: string; sources?: Source[] } & Partial<Meta>>(
        `/api/projects/${slug}/ask`,
        { question }
      );

      setAnswer(data.answer);
      setSources(data.sources ?? []);
      setMeta({
        intent: data.intent ?? "probabilistic",
        reason: data.reason ?? "",
        rows: data.rows ?? [],
        totalRows: data.totalRows ?? 0,
      });
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

      <ExampleQuestions questions={exampleQuestions} disabled={loading} onSelect={handleExample} />

      {error && (
        <p className="mt-6 rounded-2xl bg-red-50 p-4 text-[15px] text-red-700">{error}</p>
      )}

      {answer && (
        <div className="mt-8">
          {meta && (
            <p className="mb-3 text-xs text-muted">
              <span
                className={`mr-2 rounded-full px-2.5 py-0.5 font-medium ${
                  meta.intent === "deterministic" ? "bg-accent/10 text-accent" : "bg-paper text-ink/70"
                }`}
              >
                {meta.intent === "deterministic" ? "Deterministic" : "Probabilistic"}
              </span>
              {meta.intent === "deterministic"
                ? "Answered directly from the data, no AI involved."
                : "Retrieved context summarised by an LLM."}{" "}
              {meta.reason && <span className="text-muted/80">Routed because {meta.reason}.</span>}
            </p>
          )}
          <p className="whitespace-pre-wrap text-[17px] leading-relaxed text-ink">{answer}</p>

          {meta && meta.rows.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-muted">
                Matching rows
                {meta.totalRows > PREVIEW_ROWS && ` (showing ${PREVIEW_ROWS} of ${meta.totalRows.toLocaleString("en-GB")})`}
              </p>
              <div className="mt-2 overflow-x-auto rounded-2xl bg-paper">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="text-muted">
                      {Object.keys(meta.rows[0]).map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {meta.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                      <tr key={i} className="border-t border-black/5 text-ink/80">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="whitespace-nowrap px-3 py-2">
                            {typeof v === "number" ? v.toLocaleString("en-GB") : v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
