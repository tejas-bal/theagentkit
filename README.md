# theagentkit

A Next.js showcase site for data-collection + AI-agent projects — for each project: the
use case, how the data was collected, a live AI Agent tab, and a raw RAG search tab.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The **AI Agent** tab answers questions two ways (see
[Deterministic vs probabilistic questions](#deterministic-vs-probabilistic-questions)).
Exact questions like counts and rankings are answered straight from the data and need
nothing. Open-ended ones do a live RAG (retrieval-augmented generation) call and need a
Groq API key. Add to `.env.local` (gitignored):

```
GROQ_API_KEY=gsk_...
```

Without it, deterministic questions still work; probabilistic ones still embed the
question and retrieve context, but the answer-generation call fails with a clear error.

## How it's structured

The Next.js app lives at the repo root; each project is a self-contained sibling folder:

```
theagentkit/
├── app/
│   ├── page.tsx, projects/[slug]/ # catalog page and the tabbed project page
│   └── api/projects/[slug]/       # ask (AI Agent tab) and search (RAG tab) routes
├── components/                   # ProjectTabs, AskTab, RagSearchTab, MarkdownContent
├── lib/
│   ├── projects.ts                # scans the repo for project folders (content.yaml)
│   ├── intent/                    # question routing: classifier, direct JSON queries, plain-text sanitizer
│   └── rag/                       # query-time RAG: embed question, search index, call Groq
└── uk-parliament-project/         # one project
    ├── README.md                   # human-facing doc
    ├── content.yaml                 # drives the site (see below)
    ├── scripts/                     # data collection script(s)
    ├── output/                      # collected data (JSON)
    └── rag/                         # offline: builds the vector index from output/
```

### Adding a new project

Drop a new top-level folder in with its own `content.yaml`:

```yaml
slug: my-project
title: My Project
tagline: One-line summary for the catalog card
tags: [tag-one, tag-two]
useCase: |
  ## Use Case
  ...
dataCollection: |
  ## Data Collection
  ...
aiAgent: |
  ## AI Agent
  Fallback text shown if the project has no RAG index (see below).
```

The catalog page and `/projects/<slug>` route pick it up automatically — no app code
changes needed. Each project's `README.md` is a separate, human-facing document; it
isn't read by the app.

### The AI Agent tab (live RAG)

If a project has a prebuilt vector index at `<project>/rag/index/`, its **AI Agent** tab
shows a live Q&A box instead of static text: the question is embedded locally
(transformers.js, no external API), matched against that project's index (vectra, an
in-memory/file-backed vector store), and the retrieved context + question are sent to
Groq to generate the answer. Projects without an index fall back to the `aiAgent`
markdown in `content.yaml`.

#### Deterministic vs probabilistic questions

Not every question needs an LLM. Before retrieval, `lib/intent/classifier.ts` routes each
question (a rule-based classifier: instant, free, and itself deterministic):

| Intent | What it covers | How it's answered |
|---|---|---|
| **Deterministic** | Counts, rankings, filters: "How many Labour MPs are there in Wales?", "Which seats changed hands at the last general election?", "Which constituencies had the smallest majorities?", "Which MPs got elected in 2025?" | Queried straight from `output/uk_constituencies.json` in `lib/intent/ukConstituencies.ts`. Exact and repeatable: no embedding, no retrieval, no LLM, no API key needed. Returns a sentence plus the matching rows as evidence. |
| **Probabilistic** | Vague or descriptive questions: "Tell me about the MP for a seat near Birmingham.", "Who is the MP for Aldershot?", anything with "near", "why", "describe" | Retrieval + Groq, as above. |

The direct-query layer is currently built for the UK constituencies dataset only. A
project without an `output/uk_constituencies.json` skips the classifier and sends every
question down the probabilistic path.

Anything the rules don't positively recognise falls through to probabilistic, so a
classifier miss costs answer quality, never correctness. Party and place names are read
from the dataset itself (plus a small alias table: "Tory", "Lib Dems", ...), and the tab
shows which path answered and why. To support a new question shape, add a kind to
`DeterministicKind`, a detection rule in `classifyIntent`, and an executor in
`ukConstituencies.ts`.

Two data quirks the deterministic answers handle: "Labour" is stored as both "Labour" and
"Labour (Co-op)" (counted together, with the Co-op share called out), and "smallest
majorities" uses each seat's most recent election, so a 2025 by-election can top the list.

**No markdown in LLM answers.** Probabilistic answers are plain sentences. The system
prompt forbids markdown, and `lib/intent/plainText.ts` strips any that slips through
anyway (the model did return `**bold**` before this), so the UI never shows literal
asterisks or pound signs.

### The RAG tab (raw retrieval)

Same index, no LLM: the **RAG** tab is a plain search box over the vector database
itself — embeds the query, does a similarity search, and returns the top 2 matches with
both representations vectra stores per item: the short natural-language summary that
was actually embedded (what the similarity score is measuring), and the full original
source record collapsed underneath for citation. No Groq call, so it also works without
`GROQ_API_KEY` set. Useful for seeing what retrieval alone surfaces, separate from the
AI Agent tab's generated answer.

To build a project's index (see `<project>/rag/` for the exact scripts — currently
Node.js, using transformers.js for embeddings):

```bash
cd uk-parliament-project/rag
npm install
node buildIndex.js
```

## Deployment

Built for Vercel: push to a connected repo and it deploys with zero extra config
(Next.js is auto-detected). Set `GROQ_API_KEY` as an environment variable in the Vercel
project settings (only probabilistic answers use it). The API routes run on the Node.js
runtime (not Edge), since local embeddings need native bindings.

`next.config.ts` marks the ONNX/transformers.js packages as external and explicitly
traces two things Vercel's file tracer can't discover on its own: the Linux x64 ONNX
runtime binaries (without them the route fails with `Cannot find module
'onnxruntime-node'`), and `output/uk_constituencies.json`, which the deterministic path
reads at runtime.
