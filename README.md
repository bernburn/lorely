# Lorely

Lorely aims to turn educational modules into stories students want to read while keeping the source lesson accurate. `LORELY_SPEC.md` is the source of truth.

**Implemented: Phase 1 and Phase 2 backend.** Upload/save lessons, generate structured Gemini Story Arcs, retrieve Series/Arcs, and continue the same narrative with a new lesson. Phase 2 supports preferences, concepts, Decisions, chapter quizzes, and Story Bible continuity. The frontend remains the Phase 1 lesson interface; the polished reader and personalization UI belong to Phase 3.

## Structure

```text
frontend/       React + Vite + TypeScript + React Router + Lucide
backend/        FastAPI + pydantic-settings + PyMongo Async + pypdf
LORELY_SPEC.md  Product and engineering requirements
```

The existing Next.js starter files are preserved in `lorely-frontend/`. Its Git metadata was moved to the project root, preserving the original commit history and placing both applications in one repository. The starter is not the Phase 1 application. The active application lives in `frontend/` and `backend/`; use these directories for development and deployment. No commit was created; Git will show the starter's original paths as removed and their preserved location as new until you stage the relocation.

## Local setup (PowerShell)

Prerequisites: Python 3.11 or newer, Node.js 24 LTS (24.15+), and a running MongoDB deployment. Node 24 also meets the frontend test tools' runtime requirements. Commands use `npm.cmd` to work with Windows PowerShell execution policies.

From the project root:

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Open `backend/.env`. The development file is created with empty credentials if it does not exist; existing files are never overwritten.

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash

MONGODB_URI=
MONGODB_DB_NAME=lorely

FRONTEND_URL=http://localhost:5173
```

Configure `MONGODB_URI` and `GEMINI_API_KEY`. For Atlas, use the deployment's working driver connection string with a database user that can read/write the `lorely` database, and allow your backend's IP in Atlas network access. URI-encode reserved characters in credentials. A URI alone does not start MongoDB. Never commit credentials. Phase 2 multi-document writes require a replica set or sharded cluster supporting transactions (Atlas supports these); there is no partial-write fallback for standalone MongoDB. Preserve an existing working URI.

`GEMINI_MODEL` is the only model selection source. Lorely never switches models automatically. The official `google-genai` SDK is pinned to 2.26.0, including its Interactions retry semantics. Settings read `backend/.env` relative to the backend directory regardless of the process's working directory; process environment variables take precedence.

Start the backend from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000/docs` for interactive API documentation. In another terminal, from the project root:

```powershell
cd frontend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173`. `frontend/.env` contains only:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

Vite must restart after development environment changes; production environment changes require a rebuild. Never put Gemini keys or MongoDB credentials in frontend variables.

## Phase 1 demo and API

1. Open `/` or `/create` and check the connection status.
2. Select **Try a Sample Lesson** to save “Introduction to Computer Networks.”
3. Confirm the returned Lesson ID and metadata, then select **View extracted text**.
4. Choose or drop a text-based PDF. Confirm each extracted page through the same lesson detail route.
5. Try a non-PDF, blank/scanned PDF, or oversized file to see clean errors.

Endpoints:

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | HTTP 200 for a running API; reports `ok` only when MongoDB responds to a real ping, otherwise `degraded`. AI is `configured` or `not_configured`; this does not call Gemini or prove model availability. |
| `POST /api/lessons/upload` | Multipart field `file`; validates/extracts with pypdf, inserts a Lesson, returns HTTP 201 with `lesson_id`, filename, title, source, page/character counts, size, status, and creation time. |
| `POST /api/lessons/sample` | Creates a fresh sample Lesson using the same schema and persistence service. |
| `GET /api/lessons/{lesson_id}` | Retrieves a known Lesson, including numbered pages and combined text. Invalid IDs return 400; missing Lessons return 404. |

Missing/invalid database configuration or connectivity returns HTTP 503 for persistence. No in-memory fallback reports fake success. There is no endpoint that lists all lessons. Upload success is returned only after MongoDB acknowledges the insert. Ambiguous connection failures can leave an unconfirmed insert; retries may create another Lesson.

The uploaded PDF is closed/disposed after reading. Only extracted text and lesson metadata are stored, not original PDF bytes. **Remove selection** clears the current UI selection; it does not delete the database record. **Change PDF** replaces the selection only after the replacement saves successfully.

## PDF limits

- 10 MiB (10 × 1024 × 1024 bytes), described as 10 MB in the UI.
- At most 80 pages and 200,000 extracted characters, including separators between pages.
- At least 100 non-whitespace characters of selectable text; scanned PDFs and tiny labels get the scanned/no-text message.
- Password-protected, malformed, wrong-type, and over-limit PDFs are rejected. Text is never silently truncated.
- No OCR. Layout, tables, and multi-column reading order depend on pypdf and may require checking against the original.

Limits are centralized in `backend/app/limits.py` and shared by the PDF service and Lesson schema. Extraction runs in a worker thread so normal parsing does not block the API event loop. These are MVP input/output limits, not process-level memory or CPU isolation for hostile PDFs. Before a public deployment, consider upload limits at the reverse proxy, rate limiting, and isolated extraction workers.

## Verification

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

Tests generate real PDF bytes and cover extraction, limits, invalid/scanned/encrypted files, Lesson invariants, HTTP responses, IDs, CORS, and sanitized configuration/database errors. Stubbed database contract tests are explicitly separate from real persistence verification and never use developer credentials.

```powershell
cd frontend
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

For a real MongoDB check, configure the URI, start both servers, save the sample and a PDF, open their detail routes, restart the backend, and retrieve the same IDs again. A successful health response alone does not verify write permissions.

Frontend component tests cover sample selection, multipart File submission, drag/drop, duplicate prevention, client-side limits, failed persistence, removal, and navigation to extracted pages. HTTP responses in these tests are stubbed; they do not prove MongoDB persistence or replace visual browser verification.

## Deployment

Vercel project root: `frontend`. Build: `npm run build`; output: `dist`. Set `VITE_API_BASE_URL=https://YOUR_BACKEND_URL` before building. `frontend/vercel.json` provides SPA rewrites so React Router routes survive refreshes.

Deploy `backend/` separately with the requirements installed. Run `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000` (use the port required by your host). Configure `MONGODB_URI`, `MONGODB_DB_NAME`, and `FRONTEND_URL=https://YOUR_VERCEL_DOMAIN`. CORS permits only the configured frontend origin. Use HTTPS in production.

## Phase 2 narrative API

Use `http://localhost:8000/docs` to exercise the engine while the frontend reader is pending.

| Endpoint | Request/result |
| --- | --- |
| `POST /api/stories/generate` | `{ "lesson_id": "<saved Lesson ID>", "preferences": { ... } }`; HTTP 201 returns `series_id`, `arc_id`, `arc_number: 1` after transaction commit. Omitted preferences use the spec defaults. |
| `GET /api/arcs/{arc_id}` | Full validated Arc, preferences, concepts, typed paragraph/Decision blocks, chapter quizzes, and `continuityUpdate`. |
| `GET /api/series/{series_id}` | Series metadata and ordered `arc_ids`; internal Story Bible is kept on the backend. |
| `POST /api/series/{series_id}/continue` | `{ "lesson_id": "<new Lesson ID>", "preferences": { ... } }`; HTTP 201 returns the same Series ID and the next Arc ID/number. |

Example generation request:

```json
{
  "lesson_id": "<saved Lesson ID>",
  "preferences": {
    "genre": "Mystery",
    "storytelling_style": "Grounded",
    "interaction_mode": "Solve Along",
    "tone": "Dramatic",
    "length": "Quick",
    "education_level": "Senior High",
    "complexity": "Balanced",
    "core_plot": "A group of students discovers an unknown device connected to their school's network."
  }
}
```

Continue with a new saved Lesson ID. Genre/Story Style cannot be supplied in continuation preferences; they are inherited. Omitted Arc-level fields inherit from the previous Arc; `core_plot: ""` explicitly clears the previous plot. Preferences reject unknown fields/values and limit Core Plot to 500 characters. Request validation returns 422, invalid path IDs 400, missing records 404, and stale concurrent continuation 409. There is no collection-list endpoint or authentication.

`app/prompts/story_generation.py` and `story_continuation.py` distinguish Allegory/Grounded/second-person You Decide and educational depth/prose complexity. Both prioritize the lesson's facts and terms over narrative preferences. Continuation sends only the new lesson, compact Bible, and previous summary, never all historical chapters. Story quality and educational accuracy still require human review; schema validation cannot prove them.

Gemini uses the official asynchronous Interactions API with Pydantic JSON Schema and `store=False`. Each request has at most **three outbound calls total**, shared by transient retries and one possible invalid-output regeneration. SDK retries are disabled. Transient 429/500/502/503/504 and transport timeouts use 1-second then 2-second exponential delays plus up to 250 ms jitter. Each attempt is bounded to 40 seconds by default (`GEMINI_REQUEST_TIMEOUT_SECONDS`, optional 5–60). Permanent failures are not retried; raw responses, SDK errors and credentials are never returned. Exhausted transient retries return HTTP 503 with a clean busy message. Repeated malformed output returns 502. No alternate model or fixture story is used in production.

The provider schema uses flat tagged blocks with nullable unused fields to avoid deeply nested object unions. Conversion preserves meaningful content and rejects conflicting fields, then validates the strict public Paragraph/Decision models. Unsupported schema annotations are projected into descriptions; backend constraints remain mandatory. The final full-story schema still requires live verification; see [Phase 2 verification](backend/PHASE2_VERIFICATION.md).

Output validators require nonempty chapters/paragraphs and end quizzes, consecutive chapter numbers, unique concepts/choices, valid answer indexes and concept references. Just Read rejects Decisions and can regenerate once; it never silently strips blocks. Solve Along permits meaningful Decisions. Story Bible updates preserve established characters/facts, merge deduplicated history, resolve known threads, and reject incoherent updates. MongoDB collections are `lessons`, `story_series`, and `story_arcs`; a unique `(series_id, arc_number)` index and a compare-and-set Arc-ID update protect concurrent continuations. Arc and Series/Bible writes commit atomically with majority write concern.

### Opt-in integration verification

Backend tests in `tests/test_stories.py` use **deterministic unit/contract fixtures**, never developer services. Live checks are opt-in and create records in the configured database:

```powershell
cd backend
# Deterministic AI output, REAL MongoDB/API writes, transaction abort and stale continuation.
.\.venv\Scripts\python.exe scripts/verify_phase2.py mongo
# Minimal REAL structured Gemini request with bounded retries.
.\.venv\Scripts\python.exe scripts/verify_phase2.py gemini
# REAL Quick Solve Along, Quick Just Read and Arc 2; consumes Gemini quota.
.\.venv\Scripts\python.exe scripts/verify_phase2.py live
```

Optionally pass `--lesson-id <existing sample Lesson ID>` to reuse a saved sample. Reports distinguish fixture-based persistence from actual Gemini generation and never print secrets. These checks preserve `.env` byte-for-byte. Only run `live` when the minimal configured-model request works. Verification records are retained for inspection; no broad database cleanup is performed.

## Later phases

Phase 3 connects the existing narrative API to personalization, the Story Reader, concept panels, Decisions, chapter checks/locking, continuation and browser progress. Phase 3 has not started.
