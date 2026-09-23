"use client";

interface ExampleQuestionsProps {
  questions: string[];
  disabled?: boolean;
  onSelect: (question: string) => void;
}

export default function ExampleQuestions({ questions, disabled, onSelect }: ExampleQuestionsProps) {
  if (questions.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-muted">Try an example</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(q)}
            className="rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-left text-[15px] text-ink/80 transition hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
