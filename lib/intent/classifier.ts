/**
 * Initial rule-based intent classifier: decides whether a question can be
 * answered deterministically by querying the structured data directly (counts,
 * filters, rankings), or is probabilistic (vague, descriptive, or fuzzy) and
 * should go through retrieval + an LLM.
 *
 * Deliberately not an LLM call: routing has to be cheap, instant, and itself
 * deterministic. Anything the rules don't positively recognise falls through to
 * probabilistic, so a miss costs answer quality, never correctness.
 *
 * Pure functions, no imports -- extend by adding a kind to DeterministicKind, a
 * detection rule in classifyIntent, and an executor in ukConstituencies.ts.
 */

export type DeterministicKind = "count" | "changed_hands" | "majority_ranking" | "elected_in_year";

export interface IntentParams {
  /** Party abbreviation as it appears in the data, e.g. "Lab", "LD". */
  party?: string;
  /** A region or country name as it appears in the data, e.g. "Wales". */
  place?: string;
  year?: number | null;
  order?: "asc" | "desc";
  limit?: number;
  /** Which election to look at per seat: the 2024-style general election, each seat's newest election, or by-elections only. */
  scope?: "general" | "latest" | "byelection";
}

export type Classification =
  | { intent: "deterministic"; kind: DeterministicKind; params: IntentParams; reason: string }
  | { intent: "probabilistic"; reason: string };

export interface Vocab {
  parties: { abbr: string; names: string[] }[];
  places: string[];
}

const PARTY_ALIASES: Record<string, string[]> = {
  Lab: ["labour", "labour co-op", "labour and co-operative"],
  Con: ["conservative", "conservatives", "tory", "tories"],
  LD: ["liberal democrat", "liberal democrats", "lib dem", "lib dems", "libdem", "libdems"],
  RUK: ["reform uk", "reform"],
  SNP: ["snp", "scottish national party", "scottish national"],
  SF: ["sinn fein"],
  Green: ["green party", "greens", "green"],
  DUP: ["dup", "democratic unionist party", "democratic unionist"],
  PC: ["plaid cymru", "plaid"],
  Ind: ["independent", "independents"],
  SDLP: ["sdlp", "social democratic and labour party"],
  Spk: ["speaker"],
  YP: ["your party"],
  RB: ["restore britain"],
  APNI: ["alliance party", "apni"],
  TUV: ["tuv", "traditional unionist voice"],
  UUP: ["uup", "ulster unionist party", "ulster unionist"],
};

const PLACE_ALIASES: Record<string, string> = {
  yorkshire: "Yorkshire and The Humber",
  "the humber": "Yorkshire and The Humber",
  humber: "Yorkshire and The Humber",
};

// Wording that signals a fuzzy or descriptive request no structured lookup can
// answer, even if it happens to mention a party or place.
const VAGUE = /\b(near|nearby|around|close to|next to|similar|tell me about|describe|explain|why|what is .* like)\b/;

const CHANGED_HANDS = /\b(changed hands|change hands|flipped|switched|gained|gains?)\b/;
const MAJORITY_ASC = /\b(smallest|narrowest|tightest|closest|lowest|slimmest|thinnest|fewest|least|marginal)\b/;
const MAJORITY_DESC = /\b(largest|biggest|highest|widest|greatest|safest|safe seats?)\b/;
const ELECTION_WORDS = /\b(elected|elect|won|win|winners?|new mps?|returned)\b/;
const BY_ELECTION = /\bby-?elections?\b/;
const COUNT_WORDS = /\b(how many|number of|count of|total number)\b/;
const YEAR = /\b(19|20)\d{2}\b/;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Index of the first whole-phrase match in `text`, or -1. */
function phraseIndex(text: string, phrase: string): number {
  const m = new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`).exec(text);
  return m ? m.index + m[1].length : -1;
}

/** Of several candidates, the one mentioned earliest in the question (ties: longer phrase). */
function findEarliest(
  text: string,
  candidates: { value: string; phrases: string[] }[]
): string | undefined {
  let best: { value: string; index: number; length: number } | undefined;
  for (const c of candidates) {
    for (const phrase of c.phrases) {
      const index = phraseIndex(text, phrase);
      if (index === -1) continue;
      if (!best || index < best.index || (index === best.index && phrase.length > best.length)) {
        best = { value: c.value, index, length: phrase.length };
      }
    }
  }
  return best?.value;
}

function findParty(q: string, vocab: Vocab): string | undefined {
  return findEarliest(
    q,
    vocab.parties.map((p) => ({
      value: p.abbr,
      phrases: [...(PARTY_ALIASES[p.abbr] ?? []), ...p.names.map(normalize)],
    }))
  );
}

function findPlace(q: string, vocab: Vocab): string | undefined {
  const known = new Set(vocab.places);
  const candidates = vocab.places.map((p) => ({ value: p, phrases: [normalize(p)] }));
  for (const [alias, target] of Object.entries(PLACE_ALIASES)) {
    if (known.has(target)) candidates.push({ value: target, phrases: [alias] });
  }
  return findEarliest(q, candidates);
}

function findLimit(q: string): number | undefined {
  // \d{1,2} can't match inside a four-digit year, so "2025" is never read as a limit.
  const m = /\b(\d{1,2})\b/.exec(q);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n >= 1 && n <= 50 ? n : undefined;
}

export function classifyIntent(question: string, vocab: Vocab): Classification {
  const q = normalize(question);

  const vague = VAGUE.exec(q);
  if (vague) {
    return {
      intent: "probabilistic",
      reason: `wording like "${vague[0]}" is vague or descriptive, so a structured lookup can't answer it`,
    };
  }

  const party = findParty(q, vocab);
  const place = findPlace(q, vocab);

  if (CHANGED_HANDS.test(q)) {
    return {
      intent: "deterministic",
      kind: "changed_hands",
      params: { party, place, scope: BY_ELECTION.test(q) ? "byelection" : "general" },
      reason: 'matched a "changed hands / gained" pattern: answerable by filtering election results recorded as a Gain',
    };
  }

  if (/\bmajorit/.test(q) || /\bmarginal\b/.test(q) || /\bsafest\b/.test(q)) {
    const order = MAJORITY_DESC.test(q) ? "desc" : MAJORITY_ASC.test(q) ? "asc" : undefined;
    if (order) {
      return {
        intent: "deterministic",
        kind: "majority_ranking",
        params: {
          order,
          limit: findLimit(q) ?? 5,
          party,
          place,
          scope: /general election/.test(q) ? "general" : "latest",
        },
        reason: `matched a ${order === "asc" ? "smallest" : "largest"} majority ranking: answerable by sorting on the recorded majority`,
      };
    }
  }

  const year = YEAR.exec(q);
  if ((year && ELECTION_WORDS.test(q)) || BY_ELECTION.test(q)) {
    return {
      intent: "deterministic",
      kind: "elected_in_year",
      params: { year: year ? Number(year[0]) : null },
      reason: year
        ? `matched "elected in ${year[0]}": answerable by filtering elections on their date`
        : "matched a by-election listing: answerable by filtering to by-elections",
    };
  }

  if (COUNT_WORDS.test(q)) {
    return {
      intent: "deterministic",
      kind: "count",
      params: { party, place },
      reason: 'matched a "how many" pattern: answerable by counting seats that match the party and place filters',
    };
  }

  return {
    intent: "probabilistic",
    reason: "no structured pattern (count, ranking, gains, election year) matched, so it needs retrieval and an LLM",
  };
}
