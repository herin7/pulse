# Pulse 
### Personal Intelligence for Founders Who Can't Afford to Forget

> Built in 24 hours by a 3rd year CS student.
> Not a side project. A statement.
> : Herin Soni, LDCE Ahmedabad

---

## 📺 Demo

[![Pulse Demo](https://img.shields.io/badge/Watch%20Demo-YouTube-red?style=for-the-badge&logo=youtube)](https://youtu.be/tPbMx9IJRHc)


**Live App → [itspulse.vercel.app](https://itspulse.vercel.app)**

---

## What Is Pulse

Pulse is a RAG-powered personal intelligence layer built for startup founders.

You talk to it like a co-founder. It remembers everything : your commitments, your competitors, your open decisions. It tracks what you said you'd do. It lives inside your data, not outside it.

It is not a chatbot. It is not a note-taking app. It is not another AI wrapper.

It treats your **thought stream as structured data** and acts on it.

---

## What It Does

### 🧠 Deep Founder Ingestion
Pulse builds its brain from 3 sources you already have:
- **LLM Self-Report** : a psychological and professional deep-dive you paste in
- **LinkedIn Profile** : raw paste of your career history and experience
- **GitHub Activity** : auto-fetched repos, languages, stars, and commit patterns

From this it generates a **Founder Character Card** : a living profile that grounds every conversation. Not generic. Brutally specific to you.

### 💬 RAG-Powered Chat
Every message is embedded in-browser, matched against your personal vector knowledge base, enriched with your open loops and competitor intel, then sent to the LLM. The AI knows your context before you explain it.

### 🔁 Open Loop Tracking
Pulse automatically extracts commitments from your conversations : *"I'll send the investor update by Friday"* : stores them as open loops, and surfaces them in the sidebar. Nothing slips.

### 🕵️ Competitor Intelligence
Add competitors once. Pulse runs daily automated web searches via Serper, LLM-summarizes results with urgency ratings (high / medium / low), and injects high-urgency threats directly into your chat context. You don't check on them. They come to you.

### 🎙️ Voice Standup
Hit the mic. Talk. Pulse transcribes your standup using browser speech recognition, generates a structured summary (moved / stalled / next), and speaks its reply back using browser voice synthesis.

### ✉️ Gmail Integration
Say *"draft an email to the investor"* : Pulse writes a polished draft, renders it in a review card, and lets you send immediately or schedule delivery. Connected per user via Google OAuth.

### ⏰ Smart Reminders
Say *"remind me to call Rahul at 6pm"* : Pulse parses it, stores it server-side, and surfaces an in-app popup at exactly the right time.

### 🔀 Multi-LLM Runtime Switching
Switch models from the UI with no restart:

| Model | Provider | Cost |
|---|---|---|
| Gemini 2.0 Flash | Google | Free |
| Llama 3.3 70B | Groq | Free |
| Claude Sonnet 4 | Anthropic | Paid |

---

## Architecture

<img width="650" height="650" alt="Untitled-2025-08-23-2231 (1)" src="https://github.com/user-attachments/assets/8df02dd8-f7ce-44ce-af9f-e240bfbf1e66" />
                

## RAG Pipeline : Deep Dive

The core of Pulse. Every chat message goes through this exact flow:

```
User types message
        │
        ▼
┌────────────────────┐
│   embed(message)   │  ← WASM Web Worker, browser-side
│   384-dim vector   │  ← all-MiniLM-L6-v2, zero API cost
└────────┬───────────┘
         │
         ▼
POST /api/chat { message, queryEmbedding, history }
         │
    ┌────┴──────────────────────────────────┐
    │           PARALLEL FETCH              │
    ├──────────────┬────────────────────────┤
    ▼              ▼                        ▼
searchSimilar() getCharacterCard()    getOpenLoops()
top-5 chunks    founder profile       active commitments
Qdrant cosine   Qdrant scroll         SQLite query
    │              │                        │
    └──────────────┴────────────────────────┘
                        │
                        ▼
              getRecentIntel()
              competitor signals
              ordered: high → medium → low
              from SQLite
                        │
                        ▼
         ┌──────────────────────────┐
         │    buildSystemPrompt()   │
         │                          │
         │  [⚠ URGENT INTEL]         ← top if high urgency exists 
         │  Founder persona         │
         │  Character card          │
         │  RAG context chunks      │
         │  Open loops              │
         │  Recent intel            │
         └──────────────┬───────────┘
                        │
                        ▼
                  callLLM()
                  Gemini / Groq / Claude
                        │
             ┌──────────┴──────────────┐
             │                         │
             ▼                         ▼
    Response to client       detectOpenLoops()
                             fire-and-forget
                             extract commitments
                             first-5-word dedup
                             insert SQLite
```

---

## Ingest + Store Pipeline

```
Founder fills 3-step onboarding form
              │
              ▼
      POST /api/ingest
        │
        ├── GitHub API (parallel fetch)
        │     GET /users/{username}
        │     GET /users/{username}/repos → top starred
        │     GET /users/{username}/repos → language agg
        │
        ├── chunkText() each source
        │     sentence-aware splitting
        │     1600 char chunks, 160 char overlap
        │     source-tagged: ai / linkedin / github
        │
        └── return chunks[] to browser
              │
              ▼
      Browser Web Worker (Thread 2)
        embed() chunks in batches of 5
        all-MiniLM-L6-v2 WASM backend
        384-dim L2-normalized vectors
              │
              ▼
      POST /api/store { chunks + embeddings }
        │
        ├── ensureCollection() : Qdrant setup + indexes
        ├── upsertChunks() : store all vectors
        │
        ├── balanced source sampling
        │     5 chunks per source
        │     prevents any source dominating the card
        │
        ├── LLM character card generation
        │     1500 token budget
        │     JSON: name · founderType · building · stage
        │           coreDrive · techStack · strengths
        │           blindspots · biggestRisk · northStar
        │           operatingStyle
        │
        └── upsertCharacterCard()
              deterministic UUID via uuidv5
              zero-vector (metadata only)
              always overwrites same point per user
```

---

## Competitor Intelligence Pipeline

```
node-cron: '0 8 * * *' : daily 8AM
              │
              ▼
      getCompetitors(userId)
              │
              ▼  Promise.allSettled : fully parallel
    ┌─────────────────────────────────┐
    │  Per competitor:                │
    │                                 │
    │  3 Serper searches (parallel):  │
    │  → "{name} product launch OR    │
    │      new feature OR update"     │
    │  → "{name} funding OR           │
    │      valuation OR raised"       │
    │  → "{name} pricing OR           │
    │      hiring OR layoffs"         │
    │                                 │
    │  Deduplicate results by title   │
    │                                 │
    │  LLM summarize → JSON:          │
    │  { summary, category, urgency } │
    │                                 │
    │  insertIntel() → SQLite         │
    └─────────────────────────────────┘
              │
              ▼
    Next chat request:
    high urgency → injected at TOP of prompt  ⚠
    medium/low   → injected at bottom
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19 + Vite 6 | Fast dev, concurrent features |
| Styling | Tailwind CSS 3 | Rapid UI |
| Embeddings | all-MiniLM-L6-v2 WASM | Zero API cost, offline capable |
| Backend | Node.js ESM + Express 5 | Modern JS, clean async |
| Vector DB | Qdrant Cloud | Best-in-class cosine search |
| SQL | SQLite + WAL | Zero infra, concurrent safe |
| Relational | PostgreSQL / Neon | Managed, time-sensitive data |
| Document | MongoDB Atlas | Flexible schema for agent profiles |
| LLMs | Gemini / Groq / Claude | Multi-provider, runtime switchable |
| Search | Serper.dev | Google results via API |
| Auth | express-session + Google OAuth | Per-user Gmail connect |
| Scheduling | node-cron | Daily competitor tracking |
| Deploy | Vercel + Railway | Free tier, fast CI |

---

## Run Locally

### Prerequisites
- Node.js v18+
- Qdrant Cloud : free at cloud.qdrant.io
- PostgreSQL : Neon.tech free tier
- MongoDB : Atlas free tier

### Setup

```bash
git clone https://github.com/herin7/pulse
cd pulse
npm install
cp server/.env.example server/.env
# fill in your keys
npm run dev
```

### Environment Variables

```env
PORT=3001
SESSION_SECRET=any-random-string

# Databases
QDRANT_URL=your_qdrant_cluster_url
QDRANT_API_KEY=your_qdrant_key
DATABASE_URL=your_postgres_url
MONGO_URI=your_mongodb_url

# LLMs : configure at least one
GEMINI_API_KEY=         # free : aistudio.google.com
GROQ_API_KEY=           # free : console.groq.com
ANTHROPIC_API_KEY=      # paid

ACTIVE_MODEL=gemini     # gemini | groq_llama | claude

# Competitor tracking
SERPER_API_KEY=         # serper.dev
TRACKER_USER_ID=        # your UUID from localStorage after first login

# Gmail (optional)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=http://localhost:3001/api/agent-setup/gmail/callback
GMAIL_REFRESH_TOKEN=
GMAIL_SENDER_EMAIL=
```

### URLs
- Frontend → http://localhost:5173
- Backend → http://localhost:3001
- Health → http://localhost:3001/health

---

## Project Structure

```
pulse/
├── client/src/
│   ├── App.jsx                  # Screen state machine
│   ├── Onboarding.jsx           # 3-step data collection
│   ├── IngestFlow.jsx           # Embed + store pipeline UI
│   ├── Chat.jsx                 # Main interface
│   ├── embeddings.worker.js     # WASM embedding web worker
│   └── useEmbeddings.js         # Hook wrapping the worker
│
└── server/
    ├── server.js                # Express app + cron scheduler
    ├── config/models.js         # LLM registry
    ├── utils/
    │   ├── llmCall.js           # Unified multi-provider LLM caller
    │   └── chunkText.js         # Sentence-aware chunker
    ├── db/
    │   ├── qdrant.js            # Vector operations
    │   ├── openLoops.js         # Commitment storage
    │   └── competitors.js       # Intel storage
    ├── routes/
    │   ├── ingest.js
    │   ├── store.js
    │   ├── chat.js
    │   ├── config.js
    │   ├── session.js
    │   ├── reminders.js
    │   └── agentSetup.js
    └── agents/
        ├── loopDetector.js
        ├── competitorTracker.js
        ├── tools.js
        ├── toolExecutor.js
        ├── reminderParser.js
        └── emailScheduler.js
```

---

## Roadmap

**🧩 Browser Extension**
Capture context from any tab : ChatGPT, Notion, Claude, articles : into Pulse memory in one click.

**🔁 Cross-Questioning Engine**
When you mention something for the 3rd time without resolving it, Pulse pushes back with a sharp, specific question referencing past context.

**⚡ Proactive Agent Triggers**
Pulse detects action items and executes without being asked. You mention a follow-up : it drafts the email before you ask.

**🕸 Relationship Graph**
Visual map of everyone you've mentioned, your open loops with them, last contacted.

**🖥 Ollama Support**
Full local mode. Zero API cost. Your data never leaves your machine.

**📱 Mobile PWA**
Add thoughts between meetings from your phone.

---

## Honest Assessment

This is a 24-hour build by a single developer.

What it has : a working RAG pipeline, real vector search, multi-source ingestion, competitor intel on a daily cron, Gmail draft and schedule flow, voice input and output, open loop extraction, multi-LLM runtime switching, and an architecture that scales.

What it doesn't have yet : the roadmap above.

---

*This README is my cover letter. The code is my resume.*
