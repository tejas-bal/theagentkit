/**
 * Calls Groq's chat completions API (OpenAI-compatible) to generate an answer
 * grounded in retrieved context. Requires GROQ_API_KEY in the environment --
 * never expose this to the client, only call it from server-side code (API
 * routes / server components).
 *
 * Model catalog changes over time -- check https://console.groq.com/docs/models
 * and override via GROQ_MODEL if the default below has been deprecated.
 */
import { stripMarkdown } from "../intent/plainText";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

// Probabilistic answers are shown as plain text, so markdown would appear as
// literal asterisks and pound signs. The prompt asks for prose; stripMarkdown()
// enforces it, since models don't reliably follow formatting instructions.
const SYSTEM_PROMPT = [
  "You answer questions about UK parliamentary constituencies using only the context provided, which comes from the UK Parliament Members API.",
  "Reply in plain prose: two to four complete sentences.",
  "Never use markdown or any formatting characters. No asterisks, no underscores for emphasis, no pound signs, no backticks, no bullet points, no numbered lists, no tables, no bold, no italics, no links.",
  "If the question is vague, say in sentences what the context does show that is relevant.",
  "If the context does not contain the answer, say so plainly instead of guessing.",
].join(" ");

export async function generateAnswer(question: string, context: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const resp = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` },
      ],
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Groq API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const answer = data.choices?.[0]?.message?.content;
  if (typeof answer !== "string") {
    throw new Error("Groq API returned an unexpected response shape");
  }
  return stripMarkdown(answer);
}
