# Pulse — Project Documentation

> Complete technical reference for every component, file, function, route, prompt, database table, and system behavior in the Pulse codebase.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Environment Variables](#3-environment-variables)
4. [Client — Frontend](#4-client--frontend)
5. [Server — Backend](#5-server--backend)
6. [Routes — API Endpoints](#6-routes--api-endpoints)
7. [Database Layer](#7-database-layer)
8. [LLM System](#8-llm-system)
9. [Agent System](#9-agent-system)
10. [Embedding System](#10-embedding-system)
11. [Text Chunking](#11-text-chunking)
12. [Session Management](#12-session-management)
13. [Cron Jobs](#13-cron-jobs)
14. [System Prompts](#14-system-prompts)
15. [Complete File Reference](#15-complete-file-reference)

---

## 1. Project Overview

**Pulse** (internally: "Life Cofounder") is an AI-powered cofounder tool for startup founders. It ingests a founder's data from three sources (LLM self-report, LinkedIn profile, GitHub activity), builds a vector-searchable knowledge base, generates a detailed founder profile ("character card"), and provides a RAG-powered chat interface that acts as a direct, opinionated AI cofounder.

Beyond chat, Pulse tracks:
- **Open loops** — commitments the founder makes during conversation, automatically extracted and surfaced when relevant.
- **Competitive intelligence** — daily automated web searches about tracked competitors, LLM-summarized with urgency ratings, injected into chat context.

### Core Product Flow

1. **Onboarding** — Founder provides 3 data sources in a step-by-step form
2. **Ingestion** — Server fetches GitHub data, chunks all text, client generates embeddings in-browser
3. **Storage** — Embeddings stored in Qdrant, LLM generates character card from balanced source sampling
4. **Chat** — RAG-powered conversation with the founder's own data as context, character card as identity, open loops and competitor intel as live context

### Tech Stack Summary

| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Frontend    | React 19, Vite 6, Tailwind CSS 3              |
| Backend     | Node.js, Express 5 (ESM)                      |
| Vector DB   | Qdrant Cloud                                  |
| SQL DB      | SQLite (better-sqlite3, WAL mode)             |
| Embeddings  | all-MiniLM-L6-v2 (in-browser, WASM)          |
| LLMs        | Gemini 2.0 Flash, Llama 3.3 70B, Claude Sonnet 4 |
| Scheduling  | node-cron                                      |
| Search API  | Serper (Google search)                         |
| Monorepo    | npm workspaces + concurrently                 |

---

## 2. Monorepo Structure

### Root `package.json`

```json
{
  "name": "life-cofounder",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["client", "server"],
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:client": "npm run dev --workspace=client",
    "dev:server": "npm run dev --workspace=server",
    "build": "npm run build --workspace=client",
    "start": "npm run start --workspace=server"
  }
}
```

### Dev Scripts

- `dev.bat` (Windows): `@echo off → cd /d "%~dp0" → npm run dev`
- `dev.sh` (Unix): `#!/usr/bin/env bash → cd "$(dirname "$0")" → npm run dev`
- Both start client (Vite dev server on 5173) and server (`node --watch server.js` on 3001) concurrently.

### `.gitignore`

```
node_modules/
dist/
.env
*.log
```

---

## 3. Environment Variables

File: `server/.env` (not committed). Template: `server/.env.example`

| Variable          | Required | Description                                                    |
|-------------------|----------|----------------------------------------------------------------|
| `PORT`            | No       | Server port. Default: `3001`                                   |
| `QDRANT_URL`      | Yes      | Qdrant Cloud cluster URL (https, port 6333)                    |
| `QDRANT_API_KEY`  | Yes      | Qdrant API key (JWT)                                           |
| `GEMINI_API_KEY`  | Yes*     | Google AI API key for Gemini 2.0 Flash                         |
| `GROQ_API_KEY`    | Yes*     | Groq API key for Llama 3.3 70B                                |
| `ANTHROPIC_API_KEY` | Yes*   | Anthropic API key for Claude Sonnet 4                          |
| `ACTIVE_MODEL`    | No       | Active LLM key: `gemini` (default), `groq_llama`, or `claude` |
| `SESSION_SECRET`  | No       | express-session secret. Default: `pulse-dev-secret`            |
| `SERPER_API_KEY`  | Yes**    | Serper.dev API key for competitor search                       |
| `TRACKER_USER_ID` | No       | UUID of user whose competitors to track via daily cron         |

\* At least the key for the active model must be set.
\** Required only if using competitor tracking.

The `.env` also contains commented-out placeholders for future integrations: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`, `GMAIL_REFRESH_TOKEN`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`.

---

## 4. Client — Frontend

### 4.1 Configuration

**`client/package.json`**
- `type: "module"` — ESM
- Dependencies: `react@19`, `react-dom@19`, `@huggingface/transformers@^3.8.1`
- Dev dependencies: `vite@6`, `@vitejs/plugin-react`, `tailwindcss@3`, `postcss`, `autoprefixer`
- Scripts: `dev` (vite), `build` (vite build), `preview` (vite preview)

**`client/vite.config.js`**
- React plugin enabled
- `worker: { format: 'es' }` — required for Web Worker ESM (HuggingFace transformers uses ESM)
- Dev server on port 5173
- Proxy: `/api` → `http://localhost:3001` with `changeOrigin: true`

**`client/tailwind.config.js`**
- Content: `./index.html`, `./src/**/*.{js,jsx}`
- No theme extensions or plugins

**`client/postcss.config.js`**
- Plugins: `tailwindcss`, `autoprefixer`

**`client/index.html`**
- Title: "Life Cofounder"
- Single `#root` div
- Entry: `/src/main.jsx`

**`client/src/index.css`**
- Three Tailwind directives: `@tailwind base`, `@tailwind components`, `@tailwind utilities`

**`client/src/main.jsx`**
- Creates React root on `#root`
- Wraps `<App />` in `<StrictMode>`

### 4.2 App.jsx — Screen State Machine

The app has three screens managed by a `screen` state variable:

| Screen       | Component     | Trigger                                    |
|--------------|---------------|--------------------------------------------|
| `onboarding` | `<Onboarding>` | Default state, or no existing session      |
| `ingesting`  | `<IngestFlow>` | After onboarding form submission           |
| `chat`       | `<Chat>`       | After store completes, or session restored |

**State variables:**
- `screen` — current screen ('onboarding' | 'ingesting' | 'chat')
- `formData` — onboarding form data, passed to IngestFlow
- `characterCard` — generated character card, passed to Chat

**Session restore (useEffect on mount):**
- Fetches `GET /api/session` with `credentials: 'include'`
- If `data.exists === true`: sets `localStorage.lc_user_id`, sets characterCard, jumps to chat screen
- On error: silently ignores, stays on onboarding

### 4.3 Onboarding.jsx — 3-Step Data Collection

A 3-step form with step indicator (3 dots — white for completed/current, zinc-700 for future).

**Step 0: LLM Self-Report**
- Displays a pre-written prompt for the founder to paste into their favorite AI
- "Copy Prompt" button copies the prompt text to clipboard
- Textarea for pasting the AI's response
- Minimum 100 characters to proceed
- The prompt asks for: profession, skills, tech stack, projects, communication style, personality, goals, blind spots, working style

**Step 1: LinkedIn Paste**
- Instructions to select-all and copy from LinkedIn profile page
- Textarea for raw paste
- Minimum 50 characters to proceed

**Step 2: GitHub Username**
- Single text input for GitHub username
- "Build my profile" button triggers `onSubmit(formData)`

**Form data shape:**
```js
{
  llmDump: string,       // AI's response about the founder
  linkedinPaste: string,  // Raw LinkedIn text
  githubUsername: string   // GitHub handle
}
```

**UI:** Dark theme (`bg-zinc-950`), centered layout, max-width 2xl, white primary buttons, zinc secondary buttons.

### 4.4 IngestFlow.jsx — Ingest Pipeline

A full-screen modal overlay that executes the ingest → embed → store pipeline with progress tracking.

**`getUserId()` function:**
- Reads `lc_user_id` from localStorage
- If missing, generates `crypto.randomUUID()`, saves to localStorage
- Returns the UUID

**Pipeline steps:**

| Step | Progress | Description                                        |
|------|----------|----------------------------------------------------|
| A    | 0→15%   | POST /api/ingest with formData + userId            |
| —    | pause   | If warnings returned, shows warning for 2.5 seconds |
| B    | 15→80%  | Generate embeddings in browser (batches of 5)      |
| C    | 80→100% | POST /api/store with embeddedChunks + userId       |
| D    | 100%    | Call onComplete(characterCard)                     |

**Embedding batch details:**
- Chunks are processed in groups of 5
- Each chunk is independently embedded via `embed(text)` from `useEmbeddings()`
- The resulting `embeddedChunks` array has shape:
  ```js
  { text, source, chunkIndex, embedding: number[384] }
  ```

**Error handling:**
- Catches all errors, displays message + "Retry" button
- The retry resets `started.current = false` and re-runs

**GitHub warning handling:**
- If `warnings` array is returned from ingest, the first warning is displayed as the step label
- Pauses for 2.5 seconds so the user can read it
- Then continues with remaining chunks

**UI:** Fixed overlay, zinc-900 card, indigo-500 progress bar, loading text above bar.

### 4.5 Chat.jsx — Chat Interface

Two-panel layout: left sidebar (founder card) + right chat area.

**Sidebar (`<Sidebar>` component, w-72):**
Displays the full character card with styled sections:
- Name (heading) + founderType (subtitle)
- Building, Stage, Core Drive, North Star — text sections
- Tech Stack — pill badges (`bg-zinc-800`)
- Founder Strengths — green dot + green text list
- Blind Spots — amber dot + amber text list
- Biggest Risk — text section
- Operating Style — text section

**Model Switcher (top-right bar):**
- Shows current model name as text + dropdown
- Three options:
  - Gemini 2.0 Flash (free)
  - Llama 3.3 70B Groq (free)
  - Claude Sonnet Anthropic
- On change: `POST /api/config/model` to switch active model on server
- On mount: `GET /api/config/model` to sync current model

**Chat area:**
- Messages displayed as bubbles:
  - User messages: `bg-indigo-600`, right-aligned, `rounded-tr-sm`
  - Assistant messages: `bg-zinc-800`, left-aligned, `rounded-tl-sm`
- Source tags shown below assistant messages as `text-zinc-500 text-xs`
- Sources are de-duplicated via `new Set()`
- Auto-scroll to bottom on new messages
- Loading indicator: "Thinking..." in zinc bubble while waiting
- Enter sends, Shift+Enter for newlines

**Message flow:**
1. User types message + presses Enter
2. Message added to local state immediately
3. `embed(text)` generates query embedding in browser
4. `POST /api/chat` with: message, userId, queryEmbedding, last 10 messages as history
5. On success: assistant message + sources added to state
6. On error: "Something went wrong. Try again." shown as assistant message

All fetches include `credentials: 'include'` for session cookies.

### 4.6 embeddings.worker.js — Web Worker

Runs in a separate thread. Uses `@huggingface/transformers` (WASM backend).

**Messages handled:**
- `{ type: 'load' }` — Initializes the pipeline:
  - `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')`
  - Sends back `{ type: 'loaded' }` when ready
- `{ type: 'embed', text, requestId }` — Generates embedding:
  - `extractor([text], { pooling: 'mean', normalize: true })`
  - Converts output to flat array via `.tolist()[0]`
  - Sends back `{ type: 'embedding', vector, requestId }`

**Model details:**
- Model: `Xenova/all-MiniLM-L6-v2`
- Quantization: q8 (automatic default for WASM)
- Output: 384-dimensional float vector, L2-normalized
- First load downloads ~33MB model, cached by browser

### 4.7 useEmbeddings.js — React Hook

Wraps the Web Worker with a clean React interface.

**Returns:**
- `isReady: boolean` — true once worker finishes loading the model
- `embed(text): Promise<number[]>` — embeds text, returns 384-dim vector

**Implementation:**
- Creates Worker on mount, terminates on unmount
- Uses a `Map<requestId, resolve>` for concurrent embedding requests
- Each `embed()` call assigns a unique `requestId` via counter
- Worker responses are matched to pending promises by `requestId`
- `embed()` returns a Promise that resolves when the worker responds

---

## 5. Server — Backend

### 5.1 server.js — Express Application

**Middleware stack (in order):**
1. `cors({ origin: 'http://localhost:5173', credentials: true })`
2. `express.json({ limit: '10mb' })` — large limit for embedding payloads
3. `express-session` — secret from env, 7-day cookies, no resave, no uninitialized save

**Routes mounted:**
- `app.use(ingestRouter)` — POST /api/ingest
- `app.use(storeRouter)` — POST /api/store
- `app.use(chatRouter)` — POST /api/chat
- `app.use(configRouter)` — GET/POST /api/config/model
- `app.use('/api', sessionRouter)` — GET /api/session

**Health check:** `GET /health` → `{ status: 'ok' }`

**Cron scheduler:**
- Inside `app.listen()` callback
- Only activates if `TRACKER_USER_ID` env var is set
- Schedules `runDailyTracker(TRACKER_USER_ID)` at `'0 8 * * *'` (daily 8 AM)
- Logs scheduling confirmation

### 5.2 config/models.js — LLM Model Registry

Exports `MODELS` object and `DEFAULT_MODEL = 'gemini'`.

```js
MODELS = {
  gemini: {
    name: "Gemini 2.0 Flash",
    provider: "google",
    model: "gemini-2.0-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiKeyEnv: "GEMINI_API_KEY",
    free: true,
  },
  groq_llama: {
    name: "Llama 3.3 70B (Groq)",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    apiKeyEnv: "GROQ_API_KEY",
    free: true,
  },
  claude: {
    name: "Claude Sonnet (Anthropic)",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    endpoint: "https://api.anthropic.com/v1/messages",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    free: false,
  },
}
```

### 5.3 utils/llmCall.js — Unified LLM Caller

**`callLLM({ modelKey, system, messages, maxTokens = 1000 })`**

Resolves model config → validates API key → makes appropriate API call.

**Model resolution order:**
1. `modelKey` parameter (if provided)
2. `process.env.ACTIVE_MODEL` (runtime-switchable)
3. `DEFAULT_MODEL` ('gemini')

**Two API formats:**

**Format A — OpenAI-compatible (Gemini, Groq):**
```
POST {endpoint}
Headers: Authorization: Bearer {apiKey}, Content-Type: application/json
Body: { model, max_tokens, messages: [{ role: 'system', content: system }, ...messages] }
Response: data.choices[0].message.content
```

**Format B — Anthropic:**
```
POST {endpoint}
Headers: x-api-key: {apiKey}, anthropic-version: 2023-06-01, Content-Type: application/json
Body: { model, max_tokens, system, messages }
Response: data.content[0].text
```

**Returns:** `{ text: string, modelUsed: string }`

**Error handling:** Throws on missing API key or non-OK response (includes response body in error message).

### 5.4 utils/chunkText.js — Text Chunker

**`chunkText(text, chunkSize = 1600, overlap = 160)`**

Sentence-aware text chunking with overlap for RAG.

**Process:**
1. Strip all HTML tags
2. Normalize whitespace (newlines → space, collapse multiple spaces)
3. Split into sentences via regex: `/[^.!?]*[.!?]+\s*/g`
4. Greedily accumulate sentences until chunk exceeds `chunkSize` chars
5. If single sentence exceeds limit, take it as-is
6. Compute overlap by rewinding sentences from end of current chunk

**Returns:** Array of `{ text, index, charCount }`

**Drop tiny trailing chunks:** Chunks under 50 characters at the end are discarded.

---

## 6. Routes — API Endpoints

### 6.1 POST /api/ingest

**File:** `server/routes/ingest.js`

**Request body:**
```json
{
  "llmDump": "string",
  "linkedinPaste": "string",
  "githubUsername": "string",
  "userId": "uuid"
}
```

**Process:**
1. Validate `userId` exists
2. If `githubUsername` provided, fetch from GitHub API (wrapped in try/catch):
   - `GET /users/{username}` — profile (name, bio, blog, repos count, followers)
   - `GET /users/{username}/repos?sort=stars&per_page=10` — top starred repos
   - `GET /users/{username}/repos?per_page=100` — all repos for language aggregation
   - All three fetched in parallel
   - Aggregates top 5 languages by repo count
   - Builds `githubText` string with all data
   - On failure: sets `githubFailed = true`, continues without GitHub data
3. Build corpus from 3 sources: `ai_self_report`, `linkedin`, `github`
4. Chunk each source via `chunkText()`, tag with source name
5. Save `userId` and `ingestDone` to session
6. Return `{ chunks, userId, warnings }`

**GitHub failure handling:**
- If GitHub returns non-200 or fetch throws: logs warning, sets `githubFailed = true`
- Response includes `warnings: ['GitHub data could not be fetched...']`
- Client displays warning for 2.5s then continues

**Response:**
```json
{
  "chunks": [{ "text": "...", "index": 0, "charCount": 1234, "source": "linkedin" }, ...],
  "userId": "uuid",
  "warnings": []
}
```

### 6.2 POST /api/store

**File:** `server/routes/store.js`

**Request body:**
```json
{
  "chunks": [{ "text": "...", "source": "...", "chunkIndex": 0, "embedding": [0.1, ...] }],
  "userId": "uuid"
}
```

**Process:**
1. Validate `userId` and `chunks` exist
2. `ensureCollection()` — create Qdrant collection + indexes if needed
3. `upsertChunks(userId, chunks)` — store all embeddings in Qdrant
4. **Balanced source sampling:** Group chunks by source, take first 5 from each source (sorted by chunkIndex), build synthesis context with `[source]: text` format
5. **LLM character card generation:** Call LLM with founder-analysis prompt
6. Parse JSON response (strip markdown code fences if present)
7. Store character card in Qdrant via `upsertCharacterCard()`
8. Save card + `storeDone` to session
9. Return `{ characterCard }`

**Character card schema:**
```json
{
  "name": "string",
  "founderType": "string",
  "building": "string",
  "stage": "string",
  "coreDrive": "string",
  "techStack": ["string"],
  "founderStrengths": ["string"],
  "blindspots": ["string"],
  "biggestRisk": "string",
  "northStar": "string",
  "operatingStyle": "string"
}
```

**LLM call details:** maxTokens = 1500 (increased from default 1000 for complete JSON output).

### 6.3 POST /api/chat

**File:** `server/routes/chat.js`

**Request body:**
```json
{
  "message": "string",
  "userId": "uuid",
  "queryEmbedding": [0.1, ...],
  "history": [{ "role": "user|assistant", "content": "..." }]
}
```

**Process:**
1. Validate `userId`, `message`, `queryEmbedding` all present
2. Parallel fetch: `searchSimilar(userId, vec, 5)` + `getCharacterCard(userId)`
3. If no character card: return 404
4. Build context string from relevant chunks: `[source]: text`
5. Fetch `getOpenLoops(userId)` and `getRecentIntel(userId, 5)`
6. **Urgency-aware intel injection:**
   - Split intel into `highUrgency` (urgency === 'high') and `restIntel` (everything else, max 3)
   - If high urgency exists: prepend `⚠ URGENT COMPETITIVE DEVELOPMENT` block at TOP of system prompt
   - Rest goes at bottom as "Recent competitive intelligence" section
7. Build system prompt with: character prompt, founder profile, context, open loops, intel
8. Clean history: strip to `{ role, content }` only (removes `sources` field from client)
9. Call LLM with system prompt + history + current message, maxTokens = 1000
10. Return `{ reply, sources }`
11. Fire-and-forget: `detectOpenLoops(userId, message)` — extracts commitments asynchronously

**Response:**
```json
{
  "reply": "string",
  "sources": ["linkedin", "github", ...]
}
```

### 6.4 GET/POST /api/config/model

**File:** `server/routes/config.js`

**POST /api/config/model** — Switch active model
- Body: `{ "modelKey": "gemini" | "groq_llama" | "claude" }`
- Validates key exists in MODELS registry
- Sets `process.env.ACTIVE_MODEL = modelKey`
- Returns: `{ activeModel, name }`

**GET /api/config/model** — Get current model + list
- Returns: `{ activeModel, name, models: [{ key, name, free }] }`

### 6.5 GET /api/session

**File:** `server/routes/session.js`

Checks if a complete session exists (storeDone + characterCard).

**Response (existing session):**
```json
{
  "exists": true,
  "userId": "uuid",
  "characterCard": { ... }
}
```

**Response (no session):**
```json
{ "exists": false }
```

---

## 7. Database Layer

### 7.1 Qdrant Vector Database

**File:** `server/db/qdrant.js`

**Connection:** `QdrantClient` with URL + API key from env.

**Collection:** `life_cofounder`
- Vector size: 384 (all-MiniLM-L6-v2)
- Distance metric: Cosine
- Payload indexes: `userId` (keyword), `type` (keyword)

**Functions:**

**`ensureCollection()`**
- Checks if collection exists via `getCollections()`
- Creates if missing
- Creates payload indexes (wrapped in individual try/catch for idempotency)

**`upsertChunks(userId, chunks)`**
- Maps each chunk to a Qdrant point with random UUID
- Payload: `{ text, userId, chunkIndex, source, type: 'chunk' }`
- Upserts with `wait: true`

**`upsertCharacterCard(userId, card)`**
- Deterministic ID via `uuidv5(userId, DNS_NAMESPACE)` — same user always overwrites same point
- Vector: zero-filled 384-dim array (card is metadata-only, not searchable by similarity)
- Payload: `{ ...card, userId, type: 'character_card' }`

**`searchSimilar(userId, queryEmbedding, topK = 5)`**
- Searches collection with vector similarity
- Filters: `userId` match AND `type === 'chunk'`
- Returns: `[{ text, score, source }]`

**`getCharacterCard(userId)`**
- Scrolls collection with filter: `userId` match AND `type === 'character_card'`
- Returns first point's payload or `null`

### 7.2 SQLite Database

**File:** `server/db/openLoops.js` and `server/db/competitors.js`

Both connect to `server/db/pulse.db`. WAL mode enabled for concurrent reads.

#### open_loops table

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS open_loops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  loop TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  createdAt TEXT DEFAULT (datetime('now')),
  closedAt TEXT
)
```

**Functions:**
- `insertLoop(userId, loop, source)` — Insert new open loop, returns the inserted row
- `getOpenLoops(userId)` — Get all open loops for user, ordered by createdAt DESC
- `findSimilarLoop(userId, loop)` — Check for duplicate by matching first 5 words (LIKE pattern) against existing open loops
- `closeLoop(userId, loopId)` — Set status='closed' and closedAt=now

#### competitors table

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS competitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT,
  addedAt TEXT DEFAULT (datetime('now'))
)
```

**Functions:**
- `addCompetitor(userId, name, domain)` — Insert competitor, returns inserted row
- `getCompetitors(userId)` — Get all competitors for user

#### competitor_intel table

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS competitor_intel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  competitorId INTEGER NOT NULL,
  competitorName TEXT NOT NULL,
  summary TEXT NOT NULL,
  rawResults TEXT NOT NULL,
  category TEXT NOT NULL,
  urgency TEXT DEFAULT 'low',
  fetchedAt TEXT DEFAULT (datetime('now'))
)
```

**Migration:** On module load, attempts `ALTER TABLE competitor_intel ADD COLUMN urgency TEXT DEFAULT 'low'` — silently catches if column already exists.

**Functions:**
- `insertIntel(userId, competitorId, competitorName, summary, rawResults, category, urgency)` — Insert intel row
- `getRecentIntel(userId, days = 7)` — Get recent intel, ordered by urgency (high→medium→low) then fetchedAt DESC
- `getIntelByCompetitor(userId, competitorId)` — Get all intel for a specific competitor

---

## 8. LLM System

### 8.1 Provider Architecture

Three LLM providers, two API format families:

| Provider  | Format              | Auth Header          | System Message Handling            |
|-----------|---------------------|----------------------|------------------------------------|
| Google    | OpenAI-compatible   | `Authorization: Bearer` | Prepended to messages array     |
| Groq      | OpenAI-compatible   | `Authorization: Bearer` | Prepended to messages array     |
| Anthropic | Anthropic native    | `x-api-key`          | Separate `system` parameter       |

### 8.2 Runtime Model Switching

Models can be switched at runtime without restart:
1. Client dropdown sends `POST /api/config/model { modelKey }`
2. Server sets `process.env.ACTIVE_MODEL = modelKey`
3. All subsequent `callLLM()` calls use the new model

### 8.3 LLM Call Sites

| Location              | Purpose                          | maxTokens |
|-----------------------|----------------------------------|-----------|
| store.js              | Character card generation        | 1500      |
| chat.js               | Chat response                    | 1000      |
| loopDetector.js       | Commitment extraction            | 200       |
| competitorTracker.js  | Competitor intel summarization   | 300       |

---

## 9. Agent System

### 9.1 Loop Detector

**File:** `server/agents/loopDetector.js`

**Function:** `detectOpenLoops(userId, userMessage)`

**Gating logic (pre-LLM filter):**
- Skip if message < 20 characters
- Skip if message contains NONE of these commitment signals:
  `'need to', 'should', 'will', 'going to', 'plan to', 'want to', 'have to', 'must', 'gonna', 'tomorrow', 'this week'`
- Both conditions must pass to call LLM

**LLM extraction:**
- System prompt requires explicit commitments (actor + action verb + specific task)
- Explicitly excludes vague intentions ("I should think about...")
- Returns JSON array of action strings starting with a verb

**Deduplication:**
- Before inserting each loop, calls `findSimilarLoop(userId, loop)`
- Matches first 5 words of loop text against existing open loops using SQL LIKE
- Only inserts if no similar open loop found

**Called from:** `chat.js` — fire-and-forget after each chat response (`.catch(console.error)`)

### 9.2 Competitor Tracker

**File:** `server/agents/competitorTracker.js`

**Function:** `fetchCompetitorIntel(userId)`

**Process per competitor (run in parallel via `Promise.allSettled`):**
1. Generate 3 search queries:
   - `{name} product launch OR new feature OR update`
   - `{name} funding OR valuation OR raised`
   - `{name} pricing OR hiring OR layoffs`
2. Execute all 3 via Serper API (POST to `https://google.serper.dev/search`)
   - `num: 5` results per query
   - `tbs: 'qdr:m'` — past month time range
3. Deduplicate results by title using a Set
4. Concatenate: `title: snippet` per result
5. Skip if no combined results
6. LLM summarization:
   - Extracts single most strategically significant development
   - Returns JSON: `{ summary, category, urgency }`
   - JSON extracted via `text.match(/\{[\s\S]*\}/)` for robustness
   - Empty summaries are skipped (no insert)
7. `insertIntel(...)` with all fields including urgency

**Serper API details:**
- Endpoint: `https://google.serper.dev/search`
- Auth: `X-API-KEY` header
- Returns `{ organic: [{ title, snippet, link, ... }] }`

**Function:** `runDailyTracker(userId)` — wrapper with top-level try/catch, called by cron.

### 9.3 Tool System

**File:** `server/agents/tools.js` — Tool definitions (OpenAI function calling format)

Three tools defined:

| Tool                   | Parameters            | Description                              |
|------------------------|-----------------------|------------------------------------------|
| `close_loop`           | `loopId: number`      | Mark an open loop as completed           |
| `add_competitor`       | `name: string, url?: string` | Add a competitor to track          |
| `get_competitor_intel` | (none)                | Get recent competitive intelligence      |

**File:** `server/agents/toolExecutor.js` — Tool execution

**`executeTool(name, args, userId)`**

| Tool                   | Action                                                     | Response                                         |
|------------------------|------------------------------------------------------------|--------------------------------------------------|
| `close_loop`           | `closeLoop(userId, args.loopId)`                           | "Got it, marking that as done."                  |
| `add_competitor`       | `addCompetitor(...)` + background `fetchCompetitorIntel()` | "Now tracking {name}. I'll gather intel..."      |
| `get_competitor_intel` | `getRecentIntel(userId, 10)`, format with urgency          | Formatted intel or "No competitor intel yet..."  |

---

## 10. Embedding System

### Architecture

Embeddings run **entirely client-side** in a Web Worker:

```
React Component
     │
     ├─ useEmbeddings() hook
     │    │
     │    ├─ isReady: boolean
     │    └─ embed(text): Promise<number[384]>
     │         │
     │         └─ postMessage → Worker → postMessage
     │
     └─ Web Worker (embeddings.worker.js)
          │
          └─ @huggingface/transformers
               │
               └─ Xenova/all-MiniLM-L6-v2 (q8, WASM)
```

### Model Specifications

| Property       | Value                    |
|----------------|--------------------------|
| Model          | Xenova/all-MiniLM-L6-v2  |
| Quantization   | q8 (WASM default)        |
| Backend        | WASM                     |
| Dimensions     | 384                      |
| Pooling        | Mean                     |
| Normalization  | L2 (enabled)             |
| Model size     | ~33MB (downloaded once)  |

### Why Client-Side?

- Zero server embedding cost
- No embedding API key required
- Works offline after first model download
- Browser caches the model

---

## 11. Text Chunking

**File:** `server/utils/chunkText.js`

**Parameters:**
- `chunkSize`: 1600 characters (default)
- `overlap`: 160 characters (default) — ensures context continuity between chunks

**Algorithm:**
1. Strip HTML tags: `/<[^>]*>/g`
2. Normalize whitespace
3. Split on sentence boundaries: `/[^.!?]*[.!?]+\s*/g`
4. Greedy accumulation: add sentences until chunk exceeds `chunkSize`
5. Compute overlap by rewinding sentences from chunk end
6. Drop trailing chunks under 50 characters

**Source tagging:** Chunking happens per-source in `ingest.js` — each chunk gets a `source` field (`ai_self_report`, `linkedin`, or `github`).

---

## 12. Session Management

**Library:** `express-session` (in-memory store)

**Configuration:**
- Secret: `process.env.SESSION_SECRET` or `'pulse-dev-secret'`
- `resave: false`
- `saveUninitialized: false`
- Cookie TTL: 7 days (`7 * 24 * 60 * 60 * 1000 ms`)

**Session data stored:**
| Field          | Set by      | Description                    |
|----------------|-------------|--------------------------------|
| `userId`       | ingest.js   | UUID from client localStorage  |
| `ingestDone`   | ingest.js   | Boolean — ingest completed     |
| `characterCard`| store.js    | Full character card object     |
| `storeDone`    | store.js    | Boolean — store completed      |

**Client-side:**
- All `fetch()` calls include `credentials: 'include'`
- CORS configured with `origin: 'http://localhost:5173'` + `credentials: true`

**Session restore flow:**
1. App mounts → `GET /api/session`
2. If session has `storeDone + characterCard`: return `{ exists: true, userId, characterCard }`
3. Client sets localStorage userId, skips to chat screen

**Limitation:** Default in-memory store loses sessions on server restart. Production would need a persistent store (e.g., connect-sqlite3).

---

## 13. Cron Jobs

**Library:** `node-cron`

**Schedule:** `'0 8 * * *'` — Daily at 08:00 server local time

**Activation:** Only if `process.env.TRACKER_USER_ID` is set

**Action:** `runDailyTracker(process.env.TRACKER_USER_ID)`
- Fetches all competitors for that user
- Runs Serper searches for each (parallel)
- LLM-summarizes results
- Stores intel in SQLite

**How to set TRACKER_USER_ID:**
1. Complete onboarding in the app
2. Open browser console: `localStorage.getItem('lc_user_id')`
3. Add to `.env`: `TRACKER_USER_ID=<that-uuid>`

---

## 14. System Prompts

### 14.1 Character Card Generation (store.js)

**System:**
```
You are a founder talent analyst who has evaluated 1000+ early-stage founders. You write profiles 
that are specific enough that if you swapped the name, a reader could NOT confuse this person with 
any other founder. Vague phrases like "passionate about technology" or "strong communicator" are 
forbidden. Every field must contain a concrete, verifiable observation. Output ONLY valid JSON with 
no commentary.
```

**User:**
```
Here is raw data about a founder — their self-report, LinkedIn, and GitHub activity. Extract a 
founder profile. Be a mirror, not a cheerleader. Identify what they are actually doing vs what 
they say they want to do. Note gaps between ambition and current output. Output this exact JSON:
{ name, founderType, building, stage, coreDrive, techStack, founderStrengths, blindspots, 
  biggestRisk, northStar, operatingStyle }

Guidelines:
- founderType: e.g. "Technical solo founder", "Second-time operator"
- stage: e.g. "Pre-product", "0→1", "Early traction"
- founderStrengths: top 3, founder-specific behavior patterns
- blindspots: brutal and specific to their founder journey, not generic advice
- biggestRisk: the single most likely reason this startup fails
```

### 14.2 Chat System Prompt (chat.js)

**Structure:**
```
[Optional: ⚠ URGENT COMPETITIVE DEVELOPMENT block]

You are {name}'s cofounder. You have previously built and exited a B2B SaaS. You are direct to 
the point of being uncomfortable. You never validate a bad idea to protect someone's feelings. 
When you see a founder avoiding something hard, you name it explicitly. You ask one sharp question 
instead of giving five options. You think in leverage — what one move creates the most downstream 
value right now.

You know this founder deeply. You know what they're building, their actual skill level, their 
blind spots, and what they've been procrastinating on. You use this to give advice that is specific 
to them, not generic startup wisdom they could find on Twitter.

When they bring you a problem, your first instinct is to diagnose root cause before suggesting 
anything. When they bring you a win, acknowledge it in one sentence then move to what's next.

Their Founder Profile: {characterCard JSON}

Relevant context from their data: {RAG chunks}

Open loops: {list or "None yet."}

[Optional: Recent competitive intelligence section]
```

### 14.3 Loop Detector (loopDetector.js)

```
You extract explicit commitments from founder messages — things they stated they WILL do, not 
things they are considering or might do. A commitment has an actor (I), an action verb (will, 
need to, going to, must), and a specific task. Vague intentions like "I should think about 
pricing" are NOT commitments. Specific actions like "I need to email the investor by Friday" 
ARE commitments. Return ONLY a JSON array of action strings starting with a verb. If no explicit 
commitment exists, return []. No explanation.
```

### 14.4 Competitor Intel Summarizer (competitorTracker.js)

**System:**
```
You are a startup competitive intelligence analyst. Be specific and factual. Output JSON only.
```

**User:**
```
You are analyzing competitive intelligence for a founder. From these search results about 
{competitor.name}, extract the single most strategically significant development from this week.

Output JSON:
{ "summary": string, "category": string, "urgency": string }

- summary: What happened + why it matters to a competing founder. Must include: what changed, 
  how significant, what a competitor should do in response. 2-3 sentences.
- category: exactly one of: funding | product | hiring | pricing | general
- urgency: exactly one of: high | medium | low

If no meaningful new development: { "summary": "", "category": "general", "urgency": "low" }
```

---

## 15. Complete File Reference

### Client Files

| File                        | Lines | Purpose                                    |
|-----------------------------|-------|--------------------------------------------|
| `client/package.json`       | 22    | Frontend dependencies and scripts          |
| `client/index.html`         | 12    | HTML shell with #root                      |
| `client/vite.config.js`     | 16    | Vite config: proxy, worker format          |
| `client/tailwind.config.js` | 11    | Tailwind content paths                     |
| `client/postcss.config.js`  | 6     | PostCSS plugins                            |
| `client/src/main.jsx`       | 10    | React entry point                          |
| `client/src/index.css`      | 3     | Tailwind directives                        |
| `client/src/App.jsx`        | ~50   | Screen state machine + session restore     |
| `client/src/Onboarding.jsx` | ~130  | 3-step onboarding form                     |
| `client/src/IngestFlow.jsx` | ~130  | Ingest → embed → store pipeline with UI    |
| `client/src/Chat.jsx`       | ~195  | Chat UI, sidebar, model switcher           |
| `client/src/embeddings.worker.js` | 19 | Web Worker for HuggingFace embeddings |
| `client/src/useEmbeddings.js` | 47  | React hook wrapping the worker             |

### Server Files

| File                              | Lines | Purpose                              |
|-----------------------------------|-------|--------------------------------------|
| `server/package.json`             | 19    | Backend dependencies and scripts     |
| `server/server.js`                | 48    | Express app, middleware, cron        |
| `server/.env.example`             | 9     | Environment variable template        |
| `server/config/models.js`        | 31    | LLM model registry                   |
| `server/utils/llmCall.js`        | 68    | Unified multi-provider LLM caller    |
| `server/utils/chunkText.js`      | ~60   | Sentence-aware text chunker          |
| `server/db/qdrant.js`            | ~105  | Qdrant vector DB operations          |
| `server/db/openLoops.js`         | ~48   | SQLite open loops CRUD               |
| `server/db/competitors.js`       | ~75   | SQLite competitors + intel CRUD      |
| `server/routes/ingest.js`        | ~90   | POST /api/ingest                     |
| `server/routes/store.js`         | ~75   | POST /api/store                      |
| `server/routes/chat.js`          | ~90   | POST /api/chat                       |
| `server/routes/config.js`        | ~27   | GET/POST /api/config/model           |
| `server/routes/session.js`       | ~16   | GET /api/session                     |
| `server/agents/loopDetector.js`  | ~40   | Commitment extraction agent          |
| `server/agents/competitorTracker.js` | ~95 | Serper search + LLM intel agent   |
| `server/agents/tools.js`        | ~42   | Tool definitions                     |
| `server/agents/toolExecutor.js`  | ~28   | Tool dispatch and execution          |

### Root Files

| File           | Purpose                             |
|----------------|-------------------------------------|
| `package.json` | Monorepo root with workspace config |
| `dev.bat`      | Windows dev start script            |
| `dev.sh`       | Unix dev start script               |
| `.gitignore`   | Git ignore rules                    |
