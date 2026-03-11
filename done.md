# Pulse — Life Cofounder | Build Log

## Project Structure

```
pulse/
├── package.json              # Root monorepo — concurrently runs client + server
├── dev.sh / dev.bat          # Shell scripts to launch both with one command
├── .gitignore
│
├── client/                   # Vite + React + Tailwind CSS
│   ├── vite.config.js        # Vite config with /api proxy to :3001, worker: { format: 'es' }
│   ├── tailwind.config.js    # Tailwind with content paths for jsx
│   ├── postcss.config.js     # PostCSS + Autoprefixer
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx               # Screen state machine: Onboarding → IngestFlow → Chat
│       ├── Onboarding.jsx        # 3-step onboarding form
│       ├── IngestFlow.jsx        # Ingest pipeline with progress bar UI
│       ├── Chat.jsx              # Chat interface with character card sidebar
│       ├── useEmbeddings.js      # React hook — Web Worker bridge for embeddings
│       ├── embeddings.worker.js  # Web Worker — runs all-MiniLM-L6-v2 in browser
│       ├── index.css             # Tailwind directives
│       └── App.css
│
└── server/                   # Node.js + Express (ESM)
    ├── server.js             # Express app — cors, routes mounted, port 3001
    ├── package.json          # type: module, deps listed
    ├── .env / .env.example   # QDRANT_URL, QDRANT_API_KEY, ANTHROPIC_API_KEY
    ├── db/
    │   └── qdrant.js         # Qdrant client — collection mgmt, upsert, search, scroll
    ├── routes/
    │   ├── ingest.js         # POST /api/ingest — GitHub fetch + text chunking
    │   ├── store.js          # POST /api/store — embed storage + Anthropic character card
    │   └── chat.js           # POST /api/chat — RAG chat with character card context
    └── utils/
        └── chunkText.js      # Text chunker — sentence splitting, overlap, HTML stripping
```

## Features Completed

### 1. Monorepo Setup
- Root `package.json` with `concurrently` to run client + server together
- `dev.sh` (Unix) and `dev.bat` (Windows) shell scripts for one-command startup
- `.gitignore` configured

### 2. Client — Vite + React + Tailwind CSS
- Vite dev server on port 5173 with API proxy to localhost:3001
- Tailwind CSS 3 with PostCSS and Autoprefixer
- Dark theme (bg-zinc-950) throughout

### 3. Onboarding.jsx — 3-Step Onboarding Flow
- **Step 0 — "Extract Yourself"**: Pre-written prompt in dark `<pre>` block, "Copy Prompt" button (clipboard API), textarea for pasting AI response, Next disabled until >100 chars
- **Step 1 — "LinkedIn Raw Paste"**: Instructions for Ctrl+A/Ctrl+C from LinkedIn, textarea, Next disabled until >50 chars
- **Step 2 — "GitHub"**: Single text input for username, "Build my profile" button calls `onSubmit(formData)`
- Step indicator: 3 dots (white = completed/current, zinc-700 = upcoming)
- State: `currentStep` (0–2), `formData: { llmDump, linkedinPaste, githubUsername }`

### 4. embeddings.worker.js — In-Browser Embedding Generation
- Web Worker using `@huggingface/transformers` (renamed from @xenova/transformers)
- Loads `Xenova/all-MiniLM-L6-v2` model (384-dim output)
- Handles `load` (init pipeline) and `embed` (generate embedding) messages
- Caches extractor for reuse across calls

### 5. useEmbeddings.js — React Hook
- Creates worker once on mount, auto-loads model
- Exposes `isReady` (bool) and `embed(text)` → `Promise<number[]>`
- Tracks pending promises in a Map keyed by `requestId`
- Cleans up worker on unmount

### 6. IngestFlow.jsx — Ingest Pipeline with Progress UI
- **Step A**: POST to `/api/ingest` with formData + userId (generated via `crypto.randomUUID()`, persisted in localStorage as `lc_user_id`)
- **Step B**: Embed each chunk in browser, batches of 5 via `Promise.all`, progress tracking
- **Step C**: POST embedded chunks to `/api/store`
- **Step D**: Receive character card, call `onComplete(characterCard)`
- UI: Full-screen dark overlay, centered card, step label, indigo progress bar, red error + retry button

### 7. Chat.jsx — Chat Interface
- **Left sidebar** (w-72): Character card display — name, title, core drive, tech stack (pill badges), strengths (green bullets), blind spots (amber bullets), building now, goals, working style, communication style
- **Right chat area**: Message list with user bubbles (indigo, right-aligned, rounded-tr-sm) and AI bubbles (zinc, left-aligned, rounded-tl-sm), source tags below AI messages
- **Input bar**: Textarea (Enter to send, Shift+Enter for newline), Send button, disabled while loading
- Generates query embedding in-browser, sends to `/api/chat` with last 10 messages as history

### 8. App.jsx — Screen State Machine
- `onboarding` → `ingesting` → `chat`
- Passes formData from Onboarding to IngestFlow
- Passes characterCard from IngestFlow to Chat

### 9. server/server.js — Express Server
- Port 3001, CORS enabled, JSON body limit 10mb
- `/health` endpoint
- Mounts: ingestRouter, storeRouter, chatRouter

### 10. server/utils/chunkText.js — Text Chunker
- Strips HTML tags, normalizes whitespace
- Splits on sentence boundaries (`[.!?]\s+`)
- Greedy chunk accumulation with configurable overlap (default: 1600 chars, 160 overlap)
- Handles oversized single sentences, drops tiny trailing chunks (≤50 chars)
- Returns `{ text, index, charCount }[]`

### 11. server/db/qdrant.js — Qdrant Vector DB Client
- `ensureCollection()` — creates `life_cofounder` collection (Cosine, 384 dims) if missing
- `upsertChunks(userId, chunks)` — stores chunks with random UUIDs
- `upsertCharacterCard(userId, card)` — deterministic UUID via uuidv5, zero vector, fetched by filter only
- `searchSimilar(userId, queryEmbedding, topK)` — filtered vector search → `{ text, score, source }`
- `getCharacterCard(userId)` — scroll with filter → payload or null

### 12. server/routes/ingest.js — POST /api/ingest
- Fetches GitHub profile, top 10 repos (by stars), all repos (for language aggregation) in parallel
- Composes `githubText` summary string
- Combines with `llmDump` and `linkedinPaste` as tagged sources
- Chunks each source via `chunkText()`, tags with source name
- Returns `{ chunks, userId }`

### 13. server/routes/store.js — POST /api/store
- Ensures Qdrant collection exists
- Upserts all embedded chunks
- Takes first 15 chunks (by chunkIndex) as synthesis context
- Calls Anthropic (claude-sonnet-4-20250514) to generate Character Card JSON
- Upserts character card to Qdrant
- Returns `{ characterCard }`

### 14. server/routes/chat.js — POST /api/chat
- Receives message, userId, queryEmbedding (client-generated), and history
- Fetches relevant chunks + character card from Qdrant in parallel
- Builds system prompt with character card + retrieved context
- Calls Anthropic with conversation history
- Returns `{ reply, sources }`

## Tech Stack
- **Frontend**: Vite, React 19, Tailwind CSS 3, @huggingface/transformers (in-browser ML)
- **Backend**: Node.js, Express 5, ESM modules
- **Vector DB**: Qdrant (@qdrant/js-client-rest)
- **LLM**: Anthropic Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Embeddings**: all-MiniLM-L6-v2 (384-dim, runs entirely in browser via Web Worker)
- **Dev Tools**: concurrently, dotenv, cors, uuid
