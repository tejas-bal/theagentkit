/**
 * Calls Groq's chat completions API (OpenAI-compatible) to generate an answer
 * grounded in retrieved context. Requires GROQ_API_KEY in the environment --
 * never expose this to the client, only call it from server-side code (API
 * routes / server components).
 *
 * Model catalog changes over time -- check https://console.groq.com/docs/models
 * and override via GROQ_MODEL if the default below has been deprecated.
 */
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

export async function generateAnswer(question: string, context: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const prompt = [
    "You are answering questions about UK parliamentary constituencies using only",
    "the context below, sourced from the UK Parliament Members API. If the context",
    "doesn't contain the answer, say so instead of guessing.",
    "",
    "Context:",
    context,
    "",
    `Question: ${question}`,
  ].join("\n");

  const resp = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
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
  return answer;
}
