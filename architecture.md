# Pulse — Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        MONOREPO (npm workspaces)                │
│                                                                 │
│  ┌──────────────────────┐       ┌────────────────────────────┐  │
│  │     client/ (5173)   │  /api │      server/ (3001)        │  │
│  │                      │──────▶│                            │  │
│  │  Vite + React 19     │       │  Express 5 (ESM)           │  │
│  │  Tailwind CSS 3      │       │                            │  │
│  │  Web Worker           │       │  ┌──────────────────────┐  │  │
│  │  (in-browser embed)  │       │  │    Routes Layer      │  │  │
│  │                      │       │  │  ingest / store /    │  │  │
│  │  Screens:            │       │  │  chat / config /     │  │  │
│  │  Onboarding          │       │  │  session             │  │  │
│  │  IngestFlow          │       │  └────────┬─────────────┘  │  │
│  │  Chat                │       │           │                │  │
│  └──────────────────────┘       │  ┌────────▼─────────────┐  │  │
│                                 │  │    Agents Layer      │  │  │
│                                 │  │  loopDetector        │  │  │
│                                 │  │  competitorTracker   │  │  │
│                                 │  │  tools / toolExecutor│  │  │
│                                 │  └────────┬─────────────┘  │  │
│                                 │           │                │  │
│                                 │  ┌────────▼─────────────┐  │  │
│                                 │  │    Data Layer        │  │  │
│                                 │  │  Qdrant (vectors)    │  │  │
│                                 │  │  SQLite (loops/intel)│  │  │
│                                 │  └──────────────────────┘  │  │
│                                 └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  Gemini  │   │  Groq    │   │  Claude  │
        │  2.0     │   │  Llama   │   │  Sonnet  │
        │  Flash   │   │  3.3 70B │   │  4       │
        └──────────┘   └──────────┘   └──────────┘
              │
              ▼
        ┌──────────┐         ┌──────────┐
        │  GitHub  │         │  Serper  │
        │  API     │         │  (search)│
        └──────────┘         └──────────┘
```

## Directory Structure

```
pulse/
├── package.json              # Root monorepo (npm workspaces)
├── dev.bat / dev.sh          # Dev start scripts
├── .gitignore
│
├── client/                   # Frontend workspace
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js        # Proxy /api → :3001, worker format 'es'
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx              # React 19 entry
│       ├── index.css             # Tailwind directives
│       ├── App.jsx               # Screen state machine
│       ├── Onboarding.jsx        # 3-step data collection
│       ├── IngestFlow.jsx        # Ingest → embed → store pipeline
│       ├── Chat.jsx              # Chat UI + sidebar + model switcher
│       ├── embeddings.worker.js  # Web Worker for HuggingFace embeddings
│       └── useEmbeddings.js      # React hook wrapping the worker
│
└── server/                   # Backend workspace
    ├── package.json
    ├── server.js             # Express app + cron scheduler
    ├── .env / .env.example
    ├── config/
    │   └── models.js         # LLM model registry
    ├── utils/
    │   ├── llmCall.js        # Unified multi-provider LLM caller
    │   └── chunkText.js      # Sentence-aware text chunker
    ├── db/
    │   ├── qdrant.js         # Qdrant vector DB client
    │   ├── openLoops.js      # SQLite — open loops table
    │   └── competitors.js    # SQLite — competitors + intel tables
    ├── routes/
    │   ├── ingest.js         # POST /api/ingest
    │   ├── store.js          # POST /api/store
    │   ├── chat.js           # POST /api/chat
    │   ├── config.js         # GET/POST /api/config/model
    │   └── session.js        # GET /api/session
    └── agents/
        ├── loopDetector.js       # Extracts founder commitments
        ├── competitorTracker.js  # Serper search + LLM summarization
        ├── tools.js              # Tool definitions (function calling)
        └── toolExecutor.js       # Tool dispatch + execution
```

## Data Flow

### 1. Onboarding → Ingest → Store → Chat

```
User fills 3 steps           POST /api/ingest             In-browser Worker
┌──────────────┐      ┌──────────────────────┐      ┌───────────────────┐
│ 1. LLM dump  │─────▶│ Fetch GitHub API     │─────▶│ embed() each chunk│
│ 2. LinkedIn   │      │ Chunk all 3 sources  │      │ all-MiniLM-L6-v2 │
│ 3. GitHub user│      │ Return chunks[]      │      │ 384-dim vectors   │
└──────────────┘      └──────────────────────┘      └────────┬──────────┘
                                                             │
                       POST /api/store                       │
                 ┌──────────────────────┐                    │
                 │ Upsert to Qdrant     │◀───────────────────┘
                 │ LLM → character card │
                 │ Save card to Qdrant  │
                 │ Save to session      │
                 └────────┬─────────────┘
                          │
                          ▼
                    ┌──────────┐
                    │   Chat   │
                    │  screen  │
                    └──────────┘
```

### 2. Chat Request Flow

```
User message
     │
     ▼
┌─────────────────┐
│ embed(message)  │  ← in-browser, Web Worker
│ 384-dim vector  │
└────────┬────────┘
         │
         ▼
POST /api/chat { message, userId, queryEmbedding, history }
         │
    ┌────┴────────────────────────────────┐
    │                                     │
    ▼                                     ▼
searchSimilar(userId, vec, 5)     getCharacterCard(userId)
    │                                     │
    └──────────┬──────────────────────────┘
               │
    ┌──────────┼──────────────────┐
    │          │                  │
    ▼          ▼                  ▼
getOpenLoops  getRecentIntel   Build system prompt
    │          │               (urgency-aware intel injection)
    └──────────┼──────────────────┘
               │
               ▼
         callLLM(system, messages)
               │
               ├──▶ Response to client
               │
               └──▶ detectOpenLoops(userId, msg)  ← fire-and-forget
```

### 3. Competitor Intelligence (Cron)

```
node-cron '0 8 * * *'
         │
         ▼
runDailyTracker(TRACKER_USER_ID)
         │
         ▼
getCompetitors(userId) → [...competitors]
         │
         ▼ (Promise.allSettled — parallel)
┌────────────────────────────┐
│ Per competitor:            │
│  3 Serper searches         │
│  (product/funding/hiring)  │
│  Deduplicate by title      │
│  LLM summarize → JSON     │
│  { summary, category,     │
│    urgency }               │
│  insertIntel(...)          │
└────────────────────────────┘
```

## Storage Architecture

### Qdrant (Vector DB)

- **Collection:** `life_cofounder`
- **Vector size:** 384 (all-MiniLM-L6-v2)
- **Distance:** Cosine
- **Payload indexes:** `userId` (keyword), `type` (keyword)

Two point types stored:
1. **Chunks** (`type: 'chunk'`) — text chunks with embeddings from onboarding data
2. **Character cards** (`type: 'character_card'`) — deterministic UUID (uuidv5), zero-vector, full profile as payload

### SQLite (`pulse.db`)

**Table: `open_loops`**
| Column    | Type    | Notes                          |
|-----------|---------|--------------------------------|
| id        | INTEGER | PK autoincrement               |
| userId    | TEXT    |                                |
| loop      | TEXT    | The commitment text            |
| source    | TEXT    | Original user message          |
| status    | TEXT    | 'open' or 'closed'            |
| createdAt | TEXT    | datetime('now')                |
| closedAt  | TEXT    | Set when closed                |

**Table: `competitors`**
| Column  | Type    | Notes            |
|---------|---------|------------------|
| id      | INTEGER | PK autoincrement |
| userId  | TEXT    |                  |
| name    | TEXT    | Company name     |
| domain  | TEXT    | Optional URL     |
| addedAt | TEXT    | datetime('now')  |

**Table: `competitor_intel`**
| Column         | Type    | Notes                          |
|----------------|---------|--------------------------------|
| id             | INTEGER | PK autoincrement               |
| userId         | TEXT    |                                |
| competitorId   | INTEGER | FK to competitors              |
| competitorName | TEXT    | Denormalized name              |
| summary        | TEXT    | LLM-generated summary         |
| rawResults     | TEXT    | JSON of raw Serper results     |
| category       | TEXT    | funding/product/hiring/pricing/general |
| urgency        | TEXT    | high/medium/low                |
| fetchedAt      | TEXT    | datetime('now')                |

## LLM Architecture

### Multi-Provider Support

All LLM calls go through `callLLM()` which abstracts two API formats:

- **Format A (OpenAI-compatible):** Gemini, Groq — system message prepended to messages array
- **Format B (Anthropic):** Claude — system as separate top-level parameter

### Model Registry

| Key         | Model               | Provider  | Free  |
|-------------|---------------------|-----------|-------|
| gemini      | gemini-2.0-flash    | Google    | Yes   |
| groq_llama  | llama-3.3-70b       | Groq      | Yes   |
| claude      | claude-sonnet-4     | Anthropic | No    |

Runtime switching via `POST /api/config/model` — sets `process.env.ACTIVE_MODEL`.

## Session Management

- **express-session** with in-memory store (default)
- 7-day cookie TTL
- Stores: `userId`, `characterCard`, `ingestDone`, `storeDone`
- Client includes `credentials: 'include'` on all fetches
- On mount, client checks `GET /api/session` to restore existing sessions

## Embedding Architecture

Embeddings run **entirely in the browser** via a Web Worker:
- Model: `Xenova/all-MiniLM-L6-v2` (quantized q8, WASM backend)
- Output: 384-dimensional vectors
- Worker communicates via `postMessage` with request IDs for concurrent embedding
- `useEmbeddings()` hook provides `isReady` state + `embed(text)` function

This means:
- No server-side embedding cost
- No API keys needed for embeddings
- Model loads once per session
- Batched embedding (5 chunks at a time) during ingest

## Agent System

### Loop Detector
- **Trigger:** Fire-and-forget after every chat response
- **Gate:** Skips short messages (<20 chars) and messages without commitment signals
- **Dedup:** Checks first 5 words of new loop against existing open loops before insert

### Competitor Tracker
- **Trigger:** Daily cron job at 08:00 + on-demand when competitor added
- **Process:** 3 parallel Serper searches per competitor, deduped, LLM-summarized
- **Output:** Summary + category + urgency, stored in SQLite

### Tools
Three tools available for function calling:
1. `close_loop` — Mark an open loop as completed
2. `add_competitor` — Add a competitor to track
3. `get_competitor_intel` — Retrieve recent competitive intelligence
