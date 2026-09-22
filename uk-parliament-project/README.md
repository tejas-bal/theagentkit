# UK Parliament Constituency Data

Data for all 650 UK parliamentary constituencies (2024 boundaries), collected from the
UK Parliament's public Members API (`https://members-api.parliament.uk`)

## API endpoints used

Base URL: `https://members-api.parliament.uk/api/Location/Constituency`

| Purpose | Endpoint | Notes |
|---|---|---|
| List all constituencies | `GET /Search?searchText=&skip={n}&take={n}` | Paginated. `totalResults` in the response gives the total count (650). Each item's `value.id` is the numeric constituency code (e.g. `4496`). |
| Overview (≈ `/overview` page) | `GET /{id}` | Constituency name, dates, current MP, party, membership history. |
| Synopsis (≈ text on `/overview` and `/location` pages) | `GET /{id}/Synopsis` | One-line summary, e.g. *"Aberafan Maesteg is a constituency in Wales. The seat has been held by Stephen Kinnock (Labour) since July 2024."* Returned with an embedded `<a href='/region/country/...'>` tag around the country/region name — stripped to plain text for the `location` field below. |
| Election history (≈ `/election-history` page) | `GET /{id}/ElectionResults` | Result, electorate, turnout, majority, winning party per election held under this constituency code. Since constituency boundaries changed in July 2024, this currently only contains the 2024 general election for every constituency — that matches what the live pages show too. |
| Boundary geometry (≈ map on `/location` page) | `GET /{id}/Geometry` | GeoJSON `MultiPolygon`. **Fetched during initial collection but deliberately excluded from the final output** (large, and not needed downstream). |

No API key or authentication is required for any of these endpoints.

## Collection script

[`scripts/generate_uk_constituencies.mjs`](scripts/generate_uk_constituencies.mjs)

```bash
node scripts/generate_uk_constituencies.mjs [outputBasename]
```

No dependencies — uses Node's built-in `fetch`.

- Fetches the full constituency list via `/Search` (paginating in batches of 20).
- For each of the 650 constituencies, fetches `overview`, `Synopsis`, and
  `ElectionResults` (sequentially per constituency, 8 constituencies concurrently —
  fetching a constituency's 3 endpoints in parallel would triple the effective
  concurrent request count and trip the API's rate limiting; confirmed by hitting a
  ~52-minute Cloudflare cooldown, `Retry-After: 3123`, after briefly running at that
  higher concurrency), retries with backoff on failure. A `Retry-After` over 15s is
  treated as a punitive ban rather than a normal throttle and fails that request
  immediately instead of waiting it out.
- Writes `output/<outputBasename>.json` (default basename: `uk_constituencies`).
- Takes a few minutes (~1,950 HTTP requests total).

### Output format

A **JSON array**, one object per constituency

```json
[
  {
    "id": "3878",
    "name": "Aldershot",
    "overview": {
      "currentRepresentation": {
        "member": {
          "value": {
            "nameFullTitle": "Alex Baker MP",
            "latestParty": { "name": "Labour", "abbreviation": "Lab" },
            "gender": "F",
            "latestHouseMembership": { "membershipStartDate": "2024-07-04T00:00:00" }
          }
        }
      }
    },
    "location": "Aldershot is a constituency in the South East region of England. The seat has been held by Alex Baker (Labour) since July 2024.",
    "election_history": [
      {
        "result": "Lab Gain",
        "electorate": 78553,
        "turnout": 48544,
        "majority": 5683,
        "winningParty": { "name": "Labour", "abbreviation": "Lab" },
        "electionTitle": "2024 General Election",
        "electionDate": "2024-07-04T00:00:00",
        "isGeneralElection": true
      }
    ]
  }
]
```

Field notes:
- `id` — the constituency's numeric code as a string (e.g. `"3878"`)
- `location` — plain-text version of the API's synopsis text with HTML tags stripped
  (the descriptive line shown on the site's `/location` page — the boundary map/geometry
  itself is not included in the output; no separate `synopsis` field either, since it
  was the same text as `location` with the HTML tag still in it)
- `overview` and `election_history` are trimmed versions of the raw API response — see
  **Data cleaning** below for what was removed and why

Result file: [`output/uk_constituencies.json`](output/uk_constituencies.json) — 650 entries.

## Data cleaning

[`rag/`](rag/) embeds each constituency record as-is (see the root
[README's AI Agent/RAG sections](../README.md#the-ai-agent-tab-live-rag)) rather than
hand-writing a summary of it — no post-processing, one JSON object per record. That
choice ran straight into a real constraint: the embedding model needs to actually fit
the whole record in its context window, or it silently truncates whatever doesn't fit
— and the raw API response is large enough that it wouldn't.

**The problem, concretely:** the raw API response for a single constituency
(`overview` + `election_history`) serializes to ~2,300–2,500 characters. Most local,
CPU-friendly embedding models — including the one this project ended up using — cap
out around **256 tokens** (~1,000 characters) per input; anything past that gets cut
off before the model ever sees it. A field order where the biggest, noisiest part
(`overview`, full of internal IDs and REST metadata) comes before the shortest,
most informative part (`location`, `election_history`) makes this worse: truncation
was cutting off *before* reaching the fields that actually distinguish one
constituency from another.

**What got removed**, verified field-by-field against all 650 records (not just one
example) before deleting anything:

| Category | Examples | Why |
|---|---|---|
| Duplicates of a value already present elsewhere | `overview.id`/`name`, `membershipFrom(Id)`, `constituencyName` | Same value as the top-level `id`/`name` in every record — checked, 0 mismatches across 650 |
| Constant across every record | `overview.startDate`/`endDate`, `house`, the whole `membershipStatus` block, `isNotional`, `candidates: []` | Same value in all 650 records (checked via distribution counts) — zero discriminative signal for search |
| Pure API/REST plumbing | `links`, `thumbnailUrl`, numeric internal `id`s | Navigation metadata / an image URL — no textual meaning |
| Off-topic for this dataset | `isLordsMainParty`, `isLordsSpiritualParty` | About the House of *Lords*; this is a Commons constituency dataset |
| Opaque codes with no attached meaning here | `governmentType`, `electionId` | Internal enum values with no lookup table in this data |
| Visual-only | `backgroundColour`, `foregroundColour` | Hex colour codes — meaningless to a text embedding model |

**What was deliberately kept despite looking similar**, because it turned out not to
be a duplicate: `membershipStartDate` looks like it should match the most recent
`electionDate`, but checking it against all 650 records showed **296 of them differ**
— it's the MP's first-ever election date (sometimes years earlier, in a
differently-shaped predecessor seat), not the 2024 election date. Also kept:
`isGeneralElection`, which looked constant from a couple of samples but is actually
`false` for 6/650 records (by-elections) — real signal, not noise.

Net effect: **~71% smaller** per record (Aldershot: 2,359 → 692 characters), which
brought the *median* record comfortably under the 256-token budget — though the
largest few records (longer names, more election detail) still sit right at the edge
(~261 estimated tokens), so a handful can still be trimmed by a token or two.

**How this shaped the model choice:** an 8,192-token model (`nomic-embed-text-v1.5`)
would have sidestepped the whole truncation problem, and was tried — but it's a ~137M
parameter model that used **7.4GB of RAM** in this environment and made the index
build unusably slow, so it was reverted. The dataset ended up using
**`Xenova/all-MiniLM-L6-v2`** (22M params, 256-token limit, the original choice) —
i.e. the cleaning effort above exists specifically *because* the practical model for
this project's resource constraints has a small context window; trimming the data was
the lever that was actually available.

**Where this leaves retrieval quality:** cleaning measurably helped broad/topical
queries (e.g. "which constituencies are in Wales?" now reliably returns Welsh seats),
but precise name lookups (e.g. "who is the MP for Aldershot?") are still often not the
top match. That's a model/format ceiling, not a noise problem: MiniLM is trained on
natural English sentences, and every document here still shares identical JSON
structural tokens (`"latestParty"`, `"electionTitle"`, etc.) that consume part of the
fixed token budget without differentiating anything, diluting the signal from the one
or two tokens that actually vary between records (the names). Accepted as a known
limitation for now rather than reshaping the data into prose to work around it.
