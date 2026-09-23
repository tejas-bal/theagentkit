/**
 * POSTs JSON and parses a JSON response, with a readable error when the server
 * doesn't answer with JSON. A crashed or timed-out serverless function returns
 * the platform's HTML/plain-text error page, and a bare `res.json()` on that
 * surfaces only a cryptic `Unexpected token '<'` instead of what went wrong.
 */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();

  let data: (T & { error?: string }) | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    // Not JSON -- fall through with the status and a short excerpt of the body.
  }

  if (!res.ok || data === null) {
    const detail =
      data?.error ??
      text
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
    throw new Error(`Request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  return data;
}
