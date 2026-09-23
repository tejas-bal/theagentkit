/**
 * Turns an LLM reply into plain prose: strips markdown syntax and joins the
 * result into ordinary sentences. The system prompt already forbids markdown,
 * but models don't reliably obey (gpt-oss answers came back with **bold**), so
 * this is the enforcement layer -- the UI never sees markdown characters.
 */

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const HORIZONTAL_RULE = /^\s*([-*_]\s*){3,}$/;
const ENDS_A_SENTENCE = /[.!?:;)"'”]$/;

export function stripMarkdown(input: string): string {
  const lines: string[] = [];
  let inFence = false;

  for (const rawLine of input.replace(/[   ]/g, " ").split(/\r?\n/)) {
    if (/^\s*```/.test(rawLine)) {
      inFence = !inFence;
      continue;
    }

    let line = rawLine;
    let wasStructural = false;

    if (!inFence) {
      if (HORIZONTAL_RULE.test(line) || TABLE_SEPARATOR.test(line)) continue;

      if (line.includes("|") && /^\s*\|/.test(line)) {
        line = line.split("|").map((c) => c.trim()).filter(Boolean).join(", ");
        wasStructural = true;
      }

      const stripped = line
        .replace(/^\s*#{1,6}\s*/, "")
        .replace(/^\s*>+\s?/, "")
        .replace(/^\s*[-*+•]\s+/, "")
        .replace(/^\s*\d+[.)]\s+/, "");
      if (stripped !== line) wasStructural = true;
      line = stripped;
    }

    line = line
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, "$1")
      .replace(/(?<![\w])_(?=\S)(.+?)(?<=\S)_(?![\w])/g, "$1")
      .replace(/~~(.+?)~~/g, "$1")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/[*#`~]/g, "")
      .trim();

    if (!line) continue;
    // A list item or heading becomes its own sentence once the marker is gone.
    if (wasStructural && !ENDS_A_SENTENCE.test(line)) line += ".";
    lines.push(line);
  }

  return lines.join(" ").replace(/\s{2,}/g, " ").trim();
}
