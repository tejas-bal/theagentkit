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
 * `location` is derived from the synopsis text with HTML tags stripped
 * (this is the same line shown on the site's .../location page).
 *
 * Output is a JSON array (one object per constituency, each with a top-level
 * "id" field).
 *
 * Usage:
 *   node scripts/generate_uk_constituencies.mjs [outputBasename]
 *
 *   outputBasename defaults to "uk_constituencies", producing
 *   output/<outputBasename>.json (relative to the current directory).
 *
 * No dependencies -- uses Node's built-in fetch.
 */
import fs from "node:fs/promises";
import path from "node:path";

const BASE = "https://members-api.parliament.uk/api/Location/Constituency";
const HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; constituency-data-collector/1.0)",
};

const MAX_RETRIES = 4;
const TIMEOUT_MS = 20_000;
const CONCURRENCY = 8;
const HTML_TAG_RE = /<[^>]+>/g;
// If the server's Retry-After exceeds this, it's a punitive rate-limit ban
// (observed: 3123s / ~52min from Cloudflare after a burst of 429s), not a
// "slow down a bit" hint -- honoring it verbatim would hang the whole run for
// nearly an hour. Fail that URL immediately instead so the script exits with
// a clear error rather than silently hanging.
const MAX_HONORED_RETRY_AFTER_MS = 15_000;

function stripHtml(text) {
  if (text == null) return null;
  return text.replace(HTML_TAG_RE, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        const retryAfter = resp.headers.get("Retry-After");
        if (retryAfter) retryAfterMs = Number(retryAfter) * 1000;
      }
    } catch (e) {
      lastErr = e.message;
    } finally {
      clearTimeout(timeout);
    }

    if (retryAfterMs !== null && retryAfterMs > MAX_HONORED_RETRY_AFTER_MS) {
      console.error(
        `  ! ${fullUrl} rate-limited with Retry-After=${Math.round(retryAfterMs / 1000)}s ` +
          `(exceeds ${MAX_HONORED_RETRY_AFTER_MS / 1000}s cap) -- giving up on this URL, not waiting it out`
      );
      return null;
    }

    await sleep(retryAfterMs ?? 1500 * (attempt + 1));
  }
  console.error(`  ! failed ${fullUrl}: ${lastErr}`);
  return null;
}

/** Paginate through the constituency search endpoint to collect every id/name. */
async function fetchAllConstituencies() {
  const items = [];
  let skip = 0;
  const take = 20;
  let total = null;

  while (total === null || skip < total) {
    const data = await getJson(`${BASE}/Search`, { searchText: "", skip, take });
    if (data === null) {
      throw new Error("Failed to fetch constituency list page");
    }
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

async function fetchConstituencyDetail(cid) {
  // Sequential, not Promise.all: this runs inside an 8-way concurrent worker
  // pool (see CONCURRENCY below), so fetching all 3 endpoints in parallel per
  // constituency would triple the effective concurrent request count and
  // trigger the API's rate limiting (confirmed: got 429s at ~24 concurrent).
  const overview = await getJson(`${BASE}/${cid}`);
  const synopsis = await getJson(`${BASE}/${cid}/Synopsis`);
  const electionResults = await getJson(`${BASE}/${cid}/ElectionResults`);

  const synopsisText = synopsis ? synopsis.value : null;
  const overviewValue = overview ? overview.value : null;

  return {
    id: String(cid),
    type: "constituency",
    name: overviewValue ? overviewValue.name : null,
    overview: overviewValue,
    synopsis: synopsisText,
    location: stripHtml(synopsisText),
    election_history: electionResults ? electionResults.value : null,
  };
}

/** Runs `worker` over `items` with at most `concurrency` in flight at once. */
async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  const errors = [];
  let nextIndex = 0;
  let done = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        results[i] = await worker(items[i]);
      } catch (e) {
        errors.push({ item: items[i], error: e.message });
        console.error(`  ! error on ${items[i].id} ${items[i].name}: ${e.message}`);
      }
      done++;
      if (done % 25 === 0 || done === items.length) {
        console.log(`  ${done}/${items.length} done`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, runWorker));
  return { results: results.filter(Boolean), errors };
}

async function main() {
  const outBase = process.argv[2] || "uk_constituencies";
  const outDir = "output";
  await fs.mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${outBase}.json`);

  console.log("Fetching constituency list...");
  const constituencies = await fetchAllConstituencies();
  console.log(`Got ${constituencies.length} constituencies. Fetching details for each...`);

  const { results, errors } = await mapWithConcurrency(constituencies, CONCURRENCY, (c) =>
    fetchConstituencyDetail(c.id)
  );

  results.sort((a, b) => Number(a.id) - Number(b.id));

  // JSON array: one object per constituency
  await fs.writeFile(jsonPath, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} constituencies to ${jsonPath}`);

  if (errors.length > 0) {
    console.error(`${errors.length} constituencies had errors:`, errors);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
