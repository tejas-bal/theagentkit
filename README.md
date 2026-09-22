# theagentkit

A Next.js showcase site for data-collection + AI-agent projects — for each project: the
use case, how the data was collected, a live AI Agent tab, and a raw RAG search tab.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The **AI Agent** tab does a live RAG (retrieval-augmented generation) call and needs a
Groq API key. Add to `.env.local` (gitignored):

```
GROQ_API_KEY=gsk_...
```

Without it, the AI Agent tab still embeds the question and retrieves matching context,
but the final answer-generation call will fail with a clear error.

## How it's structured

The Next.js app lives at the repo root; each project is a self-contained sibling folder:

```
theagentkit/
├── app/                          # catalog page, project detail page, RAG API route
├── components/                   # ProjectTabs, AskTab, MarkdownContent
├── lib/
│   ├── projects.ts                # scans the repo for project folders (content.yaml)
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

### The RAG tab (raw retrieval)

Same index, no LLM: the **RAG** tab is a plain search box over the vector database
itself — embeds the query, does a similarity search, and returns the top 2 matching
documents as-is (name, similarity score, full text). No Groq call, so it also works
without `GROQ_API_KEY` set. Useful for seeing what retrieval alone surfaces, separate
from the AI Agent tab's generated answer.

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
project settings — the AI Agent tab's API route runs on the Node.js runtime (not Edge),
since local embeddings need native bindings.
