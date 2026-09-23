/**
 * Deterministic answers for the UK constituencies dataset: queries
 * output/uk_constituencies.json directly (counts, filters, sorts) -- no
 * retrieval, no LLM, so the same question always gives the same, exact answer.
 * Answers are built as plain sentences (no markdown), plus the matching rows so
 * a caller can show the evidence.
 */
import fs from "node:fs";
import path from "node:path";

import type { Classification, IntentParams, Vocab } from "./classifier";

export interface Election {
  title: string;
  date: string;
  isGeneral: boolean;
  result: string;
  winnerParty: string;
  winnerAbbr: string;
  majority: number | null;
}

export interface Seat {
  id: string;
  name: string;
  region: string;
  country: string;
  mp: string | null;
  partyName: string | null;
  partyAbbr: string | null;
  /** Newest first. */
  elections: Election[];
}

export interface Dataset {
  seats: Seat[];
  vocab: Vocab;
  partyLabels: Record<string, string>;
}

export type Row = Record<string, string | number>;

export interface DeterministicResult {
  answer: string;
  rows: Row[];
  total: number;
}

const MAX_ROWS = 50;
const DEFAULT_LIST_IN_SENTENCE = 10;

interface RawElection {
  electionTitle?: string;
  electionDate?: string;
  isGeneralElection?: boolean;
  result?: string;
  majority?: number | null;
  winningParty?: { name?: string; abbreviation?: string };
}

interface RawEntry {
  id: string;
  name: string;
  location?: string;
  overview?: {
    currentRepresentation?: {
      member?: {
        value?: {
          nameFullTitle?: string;
          latestParty?: { name?: string; abbreviation?: string };
        };
      };
    };
  } | null;
  election_history?: RawElection[] | null;
}

const cache = new Map<string, Dataset>();

function parseRegion(location: string | undefined): string {
  const m = /is a constituency in (?:the )?(.+?)(?: region of England|, England)?\./.exec(location ?? "");
  return m ? m[1] : "Unknown";
}

function countryOf(region: string): string {
  return region === "Wales" || region === "Scotland" || region === "Northern Ireland" ? region : "England";
}

function toSeat(raw: RawEntry): Seat {
  const member = raw.overview?.currentRepresentation?.member?.value;
  const region = parseRegion(raw.location);
  const elections: Election[] = (raw.election_history ?? [])
    .map((e) => ({
      title: e.electionTitle ?? "",
      date: e.electionDate ?? "",
      isGeneral: e.isGeneralElection === true,
      result: e.result ?? "",
      winnerParty: e.winningParty?.name ?? "",
      winnerAbbr: e.winningParty?.abbreviation ?? "",
      majority: typeof e.majority === "number" ? e.majority : null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    id: String(raw.id),
    name: raw.name,
    region,
    country: countryOf(region),
    mp: member?.nameFullTitle ?? null,
    partyName: member?.latestParty?.name ?? null,
    partyAbbr: member?.latestParty?.abbreviation ?? null,
    elections,
  };
}

function buildVocab(seats: Seat[]): { vocab: Vocab; partyLabels: Record<string, string> } {
  // Several names can share one abbreviation ("Labour" and "Labour (Co-op)" are both "Lab").
  const namesByAbbr = new Map<string, Map<string, number>>();
  for (const s of seats) {
    if (!s.partyAbbr || !s.partyName) continue;
    const names = namesByAbbr.get(s.partyAbbr) ?? new Map<string, number>();
    names.set(s.partyName, (names.get(s.partyName) ?? 0) + 1);
    namesByAbbr.set(s.partyAbbr, names);
  }

  const partyLabels: Record<string, string> = {};
  const parties = [...namesByAbbr.entries()].map(([abbr, names]) => {
    // Label a party by its most common name, so "Lab" reads as "Labour", not "Labour (Co-op)".
    partyLabels[abbr] = [...names.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return { abbr, names: [...names.keys()] };
  });

  const places = new Set<string>(["England"]);
  for (const s of seats) {
    places.add(s.region);
    places.add(s.country);
  }
  places.delete("Unknown");

  return { vocab: { parties, places: [...places] }, partyLabels };
}

/** Loads (and caches) the dataset for a project folder, or null if it has none. */
export function loadDataset(projectDir: string): Dataset | null {
  const file = path.join(process.cwd(), projectDir, "output", "uk_constituencies.json");
  const cached = cache.get(file);
  if (cached) return cached;
  if (!fs.existsSync(file)) return null;

  const seats = (JSON.parse(fs.readFileSync(file, "utf8")) as RawEntry[]).map(toSeat);
  const dataset: Dataset = { seats, ...buildVocab(seats) };
  cache.set(file, dataset);
  return dataset;
}

function inPlace(seat: Seat, place: string | undefined): boolean {
  return !place || seat.region === place || seat.country === place;
}

function pickElection(seat: Seat, scope: IntentParams["scope"]): Election | undefined {
  if (scope === "general") return seat.elections.find((e) => e.isGeneral);
  if (scope === "byelection") return seat.elections.find((e) => !e.isGeneral);
  return seat.elections[0];
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function fmt(n: number): string {
  return n.toLocaleString("en-GB");
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function breakdown(counts: Map<string, number>): string {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, n]) => `${label} ${fmt(n)}`)
    .join(", ");
}

function inPlaceClause(place: string | undefined): string {
  return place ? ` in ${place}` : "";
}

function count(ds: Dataset, params: IntentParams): DeterministicResult {
  const { party, place } = params;
  const scoped = ds.seats.filter((s) => inPlace(s, place));
  const matching = scoped.filter((s) => s.mp && (!party || s.partyAbbr === party));
  const vacant = scoped.filter((s) => !s.mp).length;
  const label = party ? ds.partyLabels[party] ?? party : "";
  const where = inPlaceClause(place);

  let answer: string;
  if (party) {
    const n = matching.length;
    const coop = party === "Lab" ? matching.filter((s) => /co-op/i.test(s.partyName ?? "")).length : 0;
    answer =
      n === 0
        ? `There are no ${label} MPs${where}.`
        : `There ${plural(n, "is", "are")} ${fmt(n)} ${label} ${plural(n, "MP", "MPs")}${where}.`;
    if (coop > 0) answer += ` This includes ${fmt(coop)} Labour (Co-op) ${plural(coop, "MP", "MPs")}.`;
  } else {
    const byParty = new Map<string, number>();
    for (const s of matching) {
      const key = ds.partyLabels[s.partyAbbr ?? ""] ?? s.partyName ?? "Unknown";
      byParty.set(key, (byParty.get(key) ?? 0) + 1);
    }
    answer = `There ${plural(matching.length, "is", "are")} ${fmt(matching.length)} sitting ${plural(matching.length, "MP", "MPs")}${where}`;
    answer += place ? `. By party: ${breakdown(byParty)}.` : ` across ${fmt(scoped.length)} constituencies. By party: ${breakdown(byParty)}.`;
  }
  // A vacant seat belongs to no party, so mentioning it under a party filter would mislead.
  if (!party && vacant > 0) answer += ` ${fmt(vacant)} ${plural(vacant, "seat is", "seats are")} currently vacant.`;

  const rows = matching.slice(0, MAX_ROWS).map((s) => ({
    Constituency: s.name,
    MP: s.mp ?? "",
    Party: s.partyName ?? "",
    Region: s.region,
  }));
  return { answer, rows, total: matching.length };
}

function changedHands(ds: Dataset, params: IntentParams): DeterministicResult {
  const { party, place, scope } = params;
  const hits: { seat: Seat; election: Election }[] = [];
  for (const seat of ds.seats) {
    if (!inPlace(seat, place)) continue;
    const election = pickElection(seat, scope);
    if (!election || !/gain/i.test(election.result)) continue;
    if (party && election.winnerAbbr !== party) continue;
    hits.push({ seat, election });
  }
  hits.sort((a, b) => a.seat.name.localeCompare(b.seat.name));

  const label = party ? ds.partyLabels[party] ?? party : "";
  const when = scope === "byelection" ? "at by-elections" : `at the ${hits[0]?.election.title || "last general election"}`;
  const where = inPlaceClause(place);
  const n = hits.length;

  let answer: string;
  if (n === 0) {
    answer = party ? `${label} gained no seats${where} ${when}.` : `No seats changed hands${where} ${when}.`;
  } else if (party) {
    answer = `${label} gained ${fmt(n)} ${plural(n, "seat", "seats")}${where} ${when}.`;
  } else {
    const byWinner = new Map<string, number>();
    for (const h of hits) byWinner.set(h.election.winnerParty, (byWinner.get(h.election.winnerParty) ?? 0) + 1);
    answer = `${fmt(n)} ${plural(n, "seat", "seats")} changed hands${where} ${when}, counting results recorded as a Gain. By winning party: ${breakdown(byWinner)}.`;
  }
  if (n > 0 && n <= DEFAULT_LIST_IN_SENTENCE) {
    answer += ` The ${plural(n, "seat is", "seats are")} ${joinNames(hits.map((h) => h.seat.name))}.`;
  }

  const rows = hits.slice(0, MAX_ROWS).map((h) => ({
    Constituency: h.seat.name,
    "Winning party": h.election.winnerParty,
    Result: h.election.result,
    Majority: h.election.majority ?? "",
  }));
  return { answer, rows, total: n };
}

function majorityRanking(ds: Dataset, params: IntentParams): DeterministicResult {
  const { party, place, scope, order = "asc" } = params;
  const limit = Math.min(params.limit ?? 5, MAX_ROWS);

  const ranked = ds.seats
    .filter((s) => inPlace(s, place))
    .map((seat) => ({ seat, election: pickElection(seat, scope) }))
    .filter((x): x is { seat: Seat; election: Election } => !!x.election && x.election.majority !== null)
    .filter((x) => !party || x.election.winnerAbbr === party)
    .sort((a, b) => (order === "asc" ? 1 : -1) * ((a.election.majority as number) - (b.election.majority as number)));

  const top = ranked.slice(0, limit);
  const adjective = order === "asc" ? "smallest" : "largest";
  const basis = scope === "general" ? "at the last general election" : "at the most recent election in each seat";
  const partyClause = party ? ` won by ${ds.partyLabels[party] ?? party}` : "";

  const items = top.map(
    (x) =>
      `${x.seat.name} (${fmt(x.election.majority as number)} ${plural(x.election.majority as number, "vote", "votes")}, ${x.election.isGeneral ? x.election.title : `by-election on ${x.election.date.slice(0, 10)}`})`
  );
  const answer =
    top.length === 0
      ? `No constituencies matched that question.`
      : `The ${top.length} ${plural(top.length, "constituency", "constituencies")}${inPlaceClause(place)}${partyClause} with the ${adjective} ${plural(top.length, "majority", "majorities")} ${basis} ${plural(top.length, "is", "are")} ${joinNames(items)}.`;

  const rows = top.map((x, i) => ({
    Rank: i + 1,
    Constituency: x.seat.name,
    "Current MP": x.seat.mp ?? "Vacant",
    "Winning party": x.election.winnerParty,
    Majority: x.election.majority as number,
    Election: x.election.title,
  }));
  return { answer, rows, total: ranked.length };
}

function electedInYear(ds: Dataset, params: IntentParams): DeterministicResult {
  const year = params.year ?? null;
  const hits: { seat: Seat; election: Election }[] = [];
  for (const seat of ds.seats) {
    for (const election of seat.elections) {
      const matches = year === null ? !election.isGeneral : new Date(election.date).getFullYear() === year;
      if (matches) hits.push({ seat, election });
    }
  }
  hits.sort((a, b) => a.election.date.localeCompare(b.election.date) || a.seat.name.localeCompare(b.seat.name));

  const period = year === null ? "by-elections" : `${year}`;
  const n = hits.length;
  let answer: string;

  if (n === 0) {
    answer = `The dataset records no elections in ${period}. It holds each seat's general election under the 2024 boundaries plus any later by-elections.`;
  } else if (n <= DEFAULT_LIST_IN_SENTENCE) {
    const parts = hits.map((h) => {
      const majority = h.election.majority !== null ? ` with a majority of ${fmt(h.election.majority)}` : "";
      const mp = h.seat.mp ? ` The current MP for ${h.seat.name} is ${h.seat.mp}.` : "";
      return `The ${h.election.title} was won by ${h.election.winnerParty} (${h.election.result})${majority}.${mp}`;
    });
    answer = `${fmt(n)} ${plural(n, "election", "elections")} in ${period} ${plural(n, "is", "are")} recorded. ${parts.join(" ")}`;
  } else {
    const byWinner = new Map<string, number>();
    for (const h of hits) byWinner.set(h.election.winnerParty, (byWinner.get(h.election.winnerParty) ?? 0) + 1);
    answer = `${fmt(n)} MPs were elected in ${period}. By winning party: ${breakdown(byWinner)}.`;
  }

  const rows = hits.slice(0, MAX_ROWS).map((h) => ({
    Constituency: h.seat.name,
    Election: h.election.title,
    "Winning party": h.election.winnerParty,
    Result: h.election.result,
    Majority: h.election.majority ?? "",
    "Current MP": h.seat.mp ?? "Vacant",
  }));
  return { answer, rows, total: n };
}

export function executeDeterministic(
  ds: Dataset,
  classification: Extract<Classification, { intent: "deterministic" }>
): DeterministicResult {
  switch (classification.kind) {
    case "count":
      return count(ds, classification.params);
    case "changed_hands":
      return changedHands(ds, classification.params);
    case "majority_ranking":
      return majorityRanking(ds, classification.params);
    case "elected_in_year":
      return electedInYear(ds, classification.params);
  }
}
