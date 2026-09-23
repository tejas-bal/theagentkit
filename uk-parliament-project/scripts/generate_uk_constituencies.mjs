#!/usr/bin/env node
/**
 * Generate uk_constituencies.json.
 *
 * Pulls data for every UK parliamentary constituency from the public
 * members-api.parliament.uk API (the API that powers members.parliament.uk,
 * which itself blocks direct HTML scraping via Cloudflare bot protection).
 *
 * For each constituency (identified by its numeric code, e.g. 4496) fetches:
 *   - overview -> GET /api/Location/Constituency/{id}
 *   - synopsis -> GET /api/Location/Constituency/{id}/Synopsis
 *   - election history -> GET /api/Location/Constituency/{id}/ElectionResults
 *
 * `location` is derived from the synopsis text with HTML tags stripped (this is
 * the same line shown on the site's .../location page). The raw synopsis text
 * itself isn't kept in the output -- it's the same content as `location`, just
 * with the HTML tag still in it, so storing both duplicated the same data.
 *
 * Output is a JSON array (one object per constituency, each with a top-level
 * "id" field).
 *
 * Being polite to the API is what makes this work. Cloudflare answers bursts with
 * a per-IP "error 1015" ban whose Retry-After runs to nearly an hour, and every
 * request sent while banned can extend it. So this script:
 *   - paces ALL requests to a global rate (REQUESTS_PER_SECOND, default 5),
 *     regardless of how many workers are running;
 *   - stops the WHOLE run the moment it is banned, instead of moving on to the
 *     next URL and hammering a blocked IP;
 *   - saves progress to output/<name>.partial.json, so a re-run picks up where it
 *     stopped rather than starting over (and re-sending ~2,000 requests);
 *   - never writes a record with missing data: a constituency that couldn't be
 *     fetched in full is retried on the next run, not saved as nulls.
 *
 * Usage:
 *   node scripts/generate_uk_constituencies.mjs [outputBasename]
 *
 *   outputBasename defaults to "uk_constituencies", producing
 *   output/<outputBasename>.json (relative to the current directory).
 *
 * Environment:
 *   REQUESTS_PER_SECOND        global request rate (default 5)
 *   UK_PARLIAMENT_API_BASE     override the API base URL (used for testing)
 *
 * Exit codes: 0 done, 1 some constituencies failed, 2 rate limited (wait, re-run).
 *
 * No dependencies -- uses Node's built-in fetch.
 */
import fs from "node:fs/promises";
import path from "node:path";

const BASE =
  process.env.UK_PARLIAMENT_API_BASE ?? "https://members-api.parliament.uk/api/Location/Constituency";
const HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; constituency-data-collector/1.0)",
};

const MAX_RETRIES = 4;
const TIMEOUT_MS = 20_000;
const CONCURRENCY = 8;
const REQUESTS_PER_SECOND = Number(process.env.REQUESTS_PER_SECOND ?? 5);
const CHECKPOINT_EVERY = 25;
const HTML_TAG_RE = /<[^>]+>/g;
// A Retry-After up to this is an ordinary "slow down" and is waited out. Anything
// longer is a punitive ban (observed: 3,000-3,400s), which no amount of retrying
// helps, so the run stops instead.
const MAX_HONORED_RETRY_AFTER_MS = 15_000;

/** The API is refusing us for long enough that continuing only makes it worse. */
class RateLimitedError extends Error {
  constructor(url, retryAfterSeconds) {
    super(`rate limited (Retry-After ${retryAfterSeconds}s) on ${url}`);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function stripHtml(text) {
  if (text == null) return null;
  return text.replace(HTML_TAG_RE, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Set the moment any request is refused with a ban-length Retry-After. Every other
// worker checks it before sending, so nothing further goes out at a banned IP.
let banned = null;

// One shared schedule for every request from every worker: each request claims the
// next free slot, so the overall rate holds however many workers are running.
let nextSlot = 0;
async function pace() {
  const interval = 1000 / REQUESTS_PER_SECOND;
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  nextSlot = start + interval;
  if (start > now) await sleep(start - now);
}

async function getJson(url, params) {
  const fullUrl = new URL(url);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      fullUrl.searchParams.set(key, value);
    }
  }

  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await pace();
    if (banned) throw banned;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let retryAfterMs = null;
    try {
      const resp = await fetch(fullUrl, { headers: HEADERS, signal: controller.signal });
      if (resp.ok) {
        return await resp.json();
      }
      lastErr = `HTTP ${resp.status}`;
      if (resp.status === 429) {
        const retryAfter = Number(resp.headers.get("Retry-After"));
        if (retryAfter > 0) {
          retryAfterMs = retryAfter * 1000;
          if (retryAfterMs > MAX_HONORED_RETRY_AFTER_MS) {
            banned = banned ?? new RateLimitedError(fullUrl.pathname, retryAfter);
            throw banned;
          }
        }
      }
    } catch (e) {
      if (e instanceof RateLimitedError) throw e;
      lastErr = e.message;
    } finally {
      clearTimeout(timeout);
    }

    await sleep(retryAfterMs ?? 1500 * (attempt + 1));
  }
  // Failing loudly (rather than returning null) is what keeps a half-fetched
  // constituency out of the output: the caller records it as failed and retries it.
  throw new Error(`failed ${fullUrl.pathname}: ${lastErr}`);
}

/** Paginate through the constituency search endpoint to collect every id/name. */
async function fetchAllConstituencies() {
  const items = [];
  let skip = 0;
  const take = 20;
  let total = null;

  while (total === null || skip < total) {
    const data = await getJson(`${BASE}/Search`, { searchText: "", skip, take });
    if (total === null) {
      total = data.totalResults;
      console.log(`Total constituencies reported by API: ${total}`);
    }
    for (const item of data.items) {
      const v = item.value;
      items.push({ id: v.id, name: v.name });
    }
    skip += take;
  }

  return items;
}

// Strips fields with no informational value for this dataset, verified against
// all 650 records before removing anything:
//   - duplicates of a value already present elsewhere (overview.id/name dupe
//     the top-level id/name; membershipFrom(Id) and constituencyName dupe the
//     same; isIndependentParty dupes what latestParty.name already says)
//   - constant across every record (overview.startDate/endDate; house=1;
//     the entire membershipStatus block; isNotional; candidates=[])
//   - REST/API plumbing with no semantic content (links, thumbnailUrl,
//     numeric ids, hex colour codes)
//   - off-topic for a Commons constituency dataset (Lords-related party flags)
//   - opaque internal codes with no attached meaning here (governmentType,
//     electionId)
// Kept despite looking similar: membershipStartDate is NOT a duplicate of
// electionDate -- it's the MP's first-ever election date, which differs from
// the 2024 election date in 296/650 records (i.e. most MPs weren't new in 2024).
function cleanParty(party) {
  if (!party) return party;
  delete party.id;
  delete party.backgroundColour;
  delete party.foregroundColour;
  delete party.isLordsMainParty;
  delete party.isLordsSpiritualParty;
  delete party.governmentType;
  delete party.isIndependentParty;
  return party;
}

function cleanOverview(overviewValue) {
  if (!overviewValue) return overviewValue;
  delete overviewValue.id;
  delete overviewValue.name;
  delete overviewValue.startDate;
  delete overviewValue.endDate;

  const cr = overviewValue.currentRepresentation;
  if (cr) {
    delete cr.representation;
    const memberValue = cr.member?.value;
    if (memberValue) {
      delete memberValue.id;
      delete memberValue.nameListAs;
      delete memberValue.nameDisplayAs;
      delete memberValue.nameAddressAs;
      delete memberValue.thumbnailUrl;
      cleanParty(memberValue.latestParty);

      const hm = memberValue.latestHouseMembership;
      if (hm) {
        delete hm.membershipFrom;
        delete hm.membershipFromId;
        delete hm.house;
        delete hm.membershipEndDate;
        delete hm.membershipEndReason;
        delete hm.membershipEndReasonNotes;
        delete hm.membershipEndReasonId;
        delete hm.membershipStatus;
      }
    }
    delete cr.member?.links;
  }
  return overviewValue;
}

function cleanElectionHistory(electionHistory) {
  if (!electionHistory) return electionHistory;
  for (const e of electionHistory) {
    delete e.isNotional;
    delete e.electionId;
    delete e.constituencyName;
    delete e.candidates;
    cleanParty(e.winningParty);
  }
  return electionHistory;
}

async function fetchConstituencyDetail(cid) {
  // Sequential, not Promise.all: pacing is global, but firing a constituency's
  // three requests together would still spike the instantaneous rate.
  const overview = await getJson(`${BASE}/${cid}`);
  const synopsis = await getJson(`${BASE}/${cid}/Synopsis`);
  const electionResults = await getJson(`${BASE}/${cid}/ElectionResults`);

  const overviewValue = overview.value;

  return {
    id: String(cid),
    name: overviewValue.name,
    overview: cleanOverview(overviewValue),
    // No separate `synopsis` field -- it's the same text as `location` with HTML
    // tags still in it, so keeping both duplicated the same content.
    location: stripHtml(synopsis.value),
    election_history: cleanElectionHistory(electionResults.value),
  };
}

/**
 * Runs `worker` over `items` with at most `concurrency` in flight. Stops handing
 * out new work as soon as any worker is rate limited (the circuit breaker); items
 * that fail for ordinary reasons are collected and the rest carry on.
 */
async function mapWithConcurrency(items, concurrency, worker, onProgress) {
  const results = [];
  const errors = [];
  let rateLimited = null;
  let nextIndex = 0;
  let done = 0;

  async function runWorker() {
    while (nextIndex < items.length && !rateLimited) {
      const item = items[nextIndex++];
      try {
        results.push(await worker(item));
      } catch (e) {
        if (e instanceof RateLimitedError) {
          rateLimited = rateLimited ?? e;
          continue;
        }
        errors.push({ item, error: e.message });
        console.error(`  ! ${item.id} ${item.name}: ${e.message}`);
      }
      done++;
      onProgress(results, done);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, runWorker));
  return { results, errors, rateLimited };
}

async function readCheckpoint(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

// Writes are queued one at a time and land via rename, so overlapping progress
// callbacks can never interleave into a corrupt checkpoint.
let checkpointQueue = Promise.resolve();
function writeCheckpoint(file, constituencies, records) {
  checkpointQueue = checkpointQueue.then(async () => {
    await fs.writeFile(`${file}.tmp`, JSON.stringify({ constituencies, records }));
    await fs.rename(`${file}.tmp`, file);
  });
  return checkpointQueue;
}

function formatWait(seconds) {
  if (!Number.isFinite(seconds)) return "an unknown time";
  const resumeAt = new Date(Date.now() + seconds * 1000);
  const hh = String(resumeAt.getHours()).padStart(2, "0");
  const mm = String(resumeAt.getMinutes()).padStart(2, "0");
  return `${Math.ceil(seconds / 60)} minutes (until about ${hh}:${mm})`;
}

async function main() {
  const outBase = process.argv[2] || "uk_constituencies";
  const outDir = "output";
  await fs.mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${outBase}.json`);
  const checkpointPath = path.join(outDir, `${outBase}.partial.json`);

  const checkpoint = await readCheckpoint(checkpointPath);
  const records = new Map(Object.entries(checkpoint?.records ?? {}));

  try {
    let constituencies = checkpoint?.constituencies;
    if (constituencies) {
      console.log(`Resuming: ${records.size}/${constituencies.length} already fetched (from ${checkpointPath}).`);
    } else {
      console.log("Fetching constituency list...");
      constituencies = await fetchAllConstituencies();
    }

    const todo = constituencies.filter((c) => !records.has(String(c.id)));
    console.log(`${constituencies.length} constituencies, ${todo.length} to fetch at ${REQUESTS_PER_SECOND} requests/second.`);

    const { results, errors, rateLimited } = await mapWithConcurrency(
      todo,
      CONCURRENCY,
      (c) => fetchConstituencyDetail(c.id),
      (soFar, done) => {
        if (done % CHECKPOINT_EVERY === 0 || done === todo.length) {
          console.log(`  ${done}/${todo.length} done`);
          const merged = Object.fromEntries([...records, ...soFar.map((r) => [r.id, r])]);
          writeCheckpoint(checkpointPath, constituencies, merged).catch(() => {});
        }
      }
    );

    for (const r of results) records.set(r.id, r);
    await writeCheckpoint(checkpointPath, constituencies, Object.fromEntries(records));

    if (rateLimited) throw rateLimited;

    if (errors.length > 0 || records.size < constituencies.length) {
      console.error(
        `\n${constituencies.length - records.size} constituencies could not be fetched in full (not saved as partial data). ` +
          `Progress kept in ${checkpointPath}; re-run to retry just those.`
      );
      process.exit(1);
    }

    const all = [...records.values()].sort((a, b) => Number(a.id) - Number(b.id));
    await fs.writeFile(jsonPath, JSON.stringify(all, null, 2));
    await fs.rm(checkpointPath, { force: true });
    console.log(`Wrote ${all.length} constituencies to ${jsonPath}`);
  } catch (e) {
    if (!(e instanceof RateLimitedError)) throw e;
    // Nothing further is sent: continuing against a banned IP only extends the ban.
    console.error(
      `\nStopped: the API is rate limiting this IP (Cloudflare error 1015).\n` +
        `Retry-After is ${e.retryAfterSeconds}s. Wait ${formatWait(Number(e.retryAfterSeconds))} before re-running,\n` +
        `and don't retry sooner -- requests sent while banned can extend it.\n` +
        `${records.size} constituencies are saved in ${checkpointPath}; the re-run resumes from there.`
    );
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
