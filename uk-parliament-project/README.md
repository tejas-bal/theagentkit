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
    "id": "4496",
    "type": "constituency",
    "name": "Aberafan Maesteg",
    "overview": { "...": "raw overview payload from the API, incl. current MP/party" },
    "synopsis": "Aberafan Maesteg is a constituency in <a href='/region/country/Wales'>Wales</a>. The seat has been held by Stephen Kinnock (Labour) since July 2024.",
    "location": "Aberafan Maesteg is a constituency in Wales. The seat has been held by Stephen Kinnock (Labour) since July 2024.",
    "election_history": [ { "result": "Lab Hold", "electorate": 72580, "turnout": 35755, "majority": 10354, "winningParty": { "...": "..." }, "electionTitle": "2024 General Election", "electionDate": "2024-07-04T00:00:00", "...": "..." } ]
  }
]
```

Field notes:
- `id` — the constituency's numeric code as a string (e.g. `"4496"`)
- `location` — plain-text version of `synopsis` with the HTML tag stripped (this is the
  descriptive line shown on the site's `/location` page — the boundary map/geometry
  itself is not included in the output).

Result file: [`output/uk_constituencies.json`](output/uk_constituencies.json) — 650 entries.
