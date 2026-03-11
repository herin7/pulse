# Pulse — Architecture

## High-Level Overview

## Latest Feature Update (March 11, 2026)

Pulse now includes a small voice-cofounder loop in the chat experience:

- Browser speech recognition lets the founder give a spoken standup from the chat composer.
- Pulse speaks its reply aloud using browser speech synthesis and the best available English voice.
- Spoken updates render a standup summary card with `moved`, `stalled`, and `next`.
- Messages that match `Remind me to ... at HH:MM` create stored reminders and later surface as in-app popups.
- Email requests now route into a draft-first Gmail flow: Pulse generates a polished email draft, renders it in a dedicated approval card, and only sends immediately or schedules delivery after explicit user action.
- Pulse now includes an `Agent Setup` surface where founders configure a primary agent's identity, BYOK settings, email identities, automation preferences, and extra operating context.
- Gmail can now be connected per user from Agent Setup through a Google OAuth popup, so email sending no longer has to rely on one shared refresh token.

This feature was added without replacing the existing RAG chat, open-loop accountability, or competitor-intel systems.

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

## Voice And Reminder Flow

### Voice Standup

Client flow:
1. User presses the mic button in chat.
2. Browser `SpeechRecognition` / `webkitSpeechRecognition` captures one spoken update.
3. The transcript is injected into the composer and auto-sent through the normal `/api/chat` flow.
4. The client creates a lightweight standup summary card using sentence heuristics:
   - `moved`
   - `stalled`
   - `next`
5. When the assistant reply returns, the client speaks it aloud with `speechSynthesis`.

### Timed Reminders

Server flow:
1. `POST /api/chat` still generates the normal assistant reply.
2. The same route also parses messages that look like `Remind me to ... at 22:06`.
3. Matching reminders are inserted into the `reminders` PostgreSQL table with `pending` status.
4. The client polls `/api/reminders/due`.
5. Due reminders are marked `delivered`, shown as modal-style popups, and may also raise browser notifications.

## Email Draft And Scheduling Flow

### Draft-first Gmail approval

Server flow:
1. `POST /api/chat` detects email intents such as `send email`, `draft mail`, or typo variants like `mial`.
2. The email drafting agent turns the user's rough request into a polished `to / subject / body` draft.
3. The route returns normal assistant text plus a structured `emailDraft` payload.
4. The client shows that payload in a dedicated email-review card instead of sending immediately.

Client flow:
1. Founder reviews and edits the drafted recipient, subject, and body.
2. Founder chooses either `Send now` or `Schedule`.
3. `Send now` calls `/api/gmail/send` and logs the action in PostgreSQL.
4. `Schedule` calls `/api/gmail/schedule`, stores the pending email in PostgreSQL, and the server sends it later through Gmail.

Background delivery:
- A lightweight server-side email scheduler checks due `scheduled` email actions every 30 seconds.
- Due emails are sent through Gmail OAuth and marked `sent`; failures are marked `failed`.

## Agent Setup Architecture

### UI sections

The new `/agent-setup` screen is split into six product sections:
- Agent Identity
- Founder Context
- Email Setup
- BYOK
- Automation Preferences
- Agent Fleet (future agents shown as coming soon)

### Persistence

Primary agent setup is stored per authenticated user in MongoDB through the `AgentProfile` model. The document shape is:
- `identity`
- `emails`
- `byok`
- `context`
- `automation`

### API routes

- `GET /api/agent-setup`
  Loads the saved primary-agent profile, debug status, and future-agent placeholders.
- `PUT /api/agent-setup`
  Saves the full primary-agent profile.
- `POST /api/agent-setup/reset`
  Resets either the full setup or only the context section.
- `GET /api/agent-setup/gmail/connect-url`
  Creates a signed Google OAuth URL for the authenticated user.
- `GET /api/agent-setup/gmail/callback`
  Exchanges the Google auth code, stores the refresh token in the user's primary-agent profile, and notifies the setup popup.
- `POST /api/agent-setup/gmail/disconnect`
  Removes the user's connected Gmail sender.

### Chat flow changes

`POST /api/chat` now also loads the saved primary-agent profile. When present, the prompt receives:
- agent identity and tone
- startup context and operating instructions
- email identities and approval mode
- automation preferences

This means the same founder profile now gets combined with a configurable operating profile before the LLM answers.

### Email sending changes

Draft send and scheduled send now resolve Gmail credentials in this order:
1. user-connected Gmail account from `AgentProfile.gmailConnection`
2. global server fallback from `.env`

### New Files Added

- `server/agents/reminderParser.js`
- `server/agents/emailScheduler.js`
- `server/db/models/AgentProfile.js`
- `server/db/reminders.js`
- `server/routes/reminders.js`
- `server/routes/agentSetup.js`

### Main UI Surface Updated

- `client/src/Chat.jsx`
  - voice mic button
  - spoken Pulse replies
  - voice standup summary card
  - reminder toast + popup delivery
