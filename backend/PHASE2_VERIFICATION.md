# Phase 2 implementation and verification

Recorded 2026-10-02, Asia/Manila. Phase 2 backend code is implemented. Full real Gemini Story Arc generation/continuation is **not yet verified**. Phase 3 has not started.

## Implementation

New files:

- `app/schemas/story.py`: controlled StoryPreferences/ContinuationPreferences, request/ID validation, EducationalConcept, ParagraphBlock, DecisionBlock, QuizQuestion, StoryChapter, GeneratedArc/GeneratedNewStory, StoryArc, StoryCreated, and private Gemini wire models.
- `app/schemas/series.py`: StoryCharacter, CharacterUpdate, StoryBible, ContinuityUpdate, StorySeries, public SeriesDetail.
- `app/services/ai_service.py`: official asynchronous Google GenAI Interactions client, centralized configured model, schema projection, strict conversion/validation, sanitized error mapping and bounded retries.
- `app/prompts/__init__.py`, `story_generation.py`, `story_continuation.py`: separate generation/continuation instructions; educational priority, all preferences, narrative quality, interaction rules and compact continuity.
- `app/services/story_service.py`: lesson-to-Series/Arc orchestration and new-lesson continuation with inherited Genre/Story Style and previous Arc defaults.
- `app/services/series_service.py`: initialization and deterministic Story Bible updates, character/fact/history preservation, deduplication and thread resolution.
- `app/services/story_repository.py`: PyMongo Async retrieval and atomic persistence, unique Arc-number index, stale continuation protection.
- `app/api/stories.py`, `app/api/series.py`: new endpoints.
- `tests/story_fixtures.py`, `tests/test_stories.py`: explicitly deterministic unit/contract fixtures and tests.
- `scripts/verify_phase2.py`: opt-in real MongoDB and real Gemini verification, clearly separated modes and sanitized diagnostics.

Changed files:

- `app/config.py`: bounded per-attempt timeout; model remains solely in existing centralized configuration.
- `app/main.py`: register new routers, version 0.2.0, generic safe unexpected-error message.
- `app/api/health.py`: AI configuration status without a Gemini inference call.
- `requirements.txt`: pin installed official `google-genai==2.26.0` and its tested retry semantics.
- `tests/test_lessons.py`: isolated empty Gemini key and updated health expectation.
- `../frontend/src/types/lesson.ts`, `../frontend/src/test/lesson-flow.test.tsx`: health contract compatibility only.
- `../README.md`: Phase 2 API, configuration, transaction requirements and verification commands.

Existing `.env`, MongoDB URI, database architecture, Lesson/PDF functionality and frontend design were preserved. `.env` byte equality was checked during real verification. No model change, authentication, public collection-list endpoint or Phase 3 reader was added.

## API and database

| Endpoint | Result |
| --- | --- |
| `POST /api/stories/generate` | New Series and Arc 1; 201 after acknowledged transaction commit. |
| `GET /api/arcs/{arc_id}` | Full validated Arc with concepts, blocks and chapter quizzes. |
| `GET /api/series/{series_id}` | Metadata and ordered Arc IDs; internal Bible excluded. |
| `POST /api/series/{series_id}/continue` | Next Arc from a new saved Lesson, same Series identity. |

Collections: existing `lessons`; new `story_series` and `story_arcs` in database **lorely**. Arc insert and Series/Bible update share a transaction with majority write concern. A unique `(series_id, arc_number)` index and expected prior `arc_ids` comparison prevent inconsistent or duplicate continuation state.

Every chapter requires narrative paragraphs and at least one end quiz. Choices/indexes, concept references and numbering validate before writes. Just Read rejects Decisions instead of removing them. Solve Along permits meaningful Decisions. Story Bible preserves established narrative facts, characters and history and resolves known threads. The new Lesson remains the educational source; continuation does not resend historical chapters.

## Retry policy

At most three outbound calls total per request, shared by transient retries and one invalid-output repair. SDK retries are disabled (`attempts=0` in SDK 2.26 Interactions). Transient 429/500/502/503/504 and transport timeouts use 1 then 2 seconds of backoff with at most 250 ms jitter. Each attempt defaults to a 40-second timeout. Permanent failures are not retried. Exhaustion returns a clean 503 busy message; repeated malformed output returns 502. No raw SDK response or exception is exposed to the API client.

## Results

| Check | Result |
| --- | --- |
| Phase 1 backend regressions | **21 passed**. |
| Phase 2 deterministic unit/contract tests | **48 passed**; total backend **69 passed**. These do not prove Gemini integration. |
| Frontend | TypeScript check, **6 tests**, production build passed. |
| Fresh Uvicorn startup and real HTTP health | Passed; HTTP 200, `status: ok`, `database: connected`, `ai: configured`, `message: null`. |
| Normal database-layer admin ping | Passed. |
| Real Phase 1 sample persistence/retrieval | Passed in `lorely`; Lesson ID `6abe9b44d279e02e4fd4a6f6`. |
| Real MongoDB + deterministic AI fixture Arc 1 | Persisted/retrieved, two chapters and one Solve Along Decision; Bible initialized. |
| Real MongoDB + deterministic AI fixture Arc 2 | Persisted/retrieved in the same Series, new Lesson ID, Just Read blocks/end quizzes, Bible and ordered Arc IDs updated. |
| Real transaction abort fault injection | Passed; real Arc insert rolled back after controlled Series-write failure; no partial Arc/Series remained. |
| Real stale continuation rejection | Passed; HTTP 409, no duplicate Arc, Series/Bible unchanged. |
| Minimal REAL Gemini structured request | **Succeeded** using exactly **gemini-3.8-flash**. No model fallback. |
| REAL Gemini full Solve Along Story Arc | **Not verified or persisted**. |
| REAL Gemini Quick Just Read | **Not verified**; unit/contract and real MongoDB fixture checks passed. |
| REAL Gemini continuation into Arc 2 | **Not verified**; unit/contract and real MongoDB fixture continuation passed. |

Final deterministic AI / real MongoDB records retained for inspection:

- Series ID: `6abea07c01915286b3279c31`
- Arc 1 ID: `6abea07c01915286b3279c32`
- Arc 2 ID: `6abea07d01915286b3279c34`

These are verification fixtures, **not Gemini-generated stories**. Production never uses them as a fallback.

## Remaining live blocker

Full structured requests returned HTTP 400 `invalid_request` with the sanitized message `Request contains an invalid argument.` Smaller concept output succeeded. Diagnostics also encountered HTTP 503 high demand. The provider schema was projected to supported JSON Schema features and given a flatter tagged block shape; the strict backend validators remain intact. **The final full-story schema's live compatibility is still unverified**, because the subsequent real attempt exhausted the service retry budget with HTTP 429.

Final upstream exception: `google.genai._gaos.lib.compat_errors.RateLimitError`. Sanitized upstream message states: `Rate limit exceeded for model gemini-3.8-flash (limit: 20 requests per day on Free Tier). Please retry in 59s or upgrade your tier at https://ai.dev/rate-limit.` No further inference calls were made after that result. This is a stated daily quota; the short retry hint is not proof the daily allowance has reset.

Keep the model unchanged. Once the project's quota is available (or its billing/tier allows further usage), rerun the minimal check, then one Quick live verification. If HTTP 400 persists, further schema compatibility diagnosis is required; this report does not claim that issue has been proven fixed.

The backend contracts can support future UI work, but full Phase 2 end-to-end acceptance and a confident Phase 3 handoff should wait for real validated/persisted generation, Just Read and continuation. Phase 3 was not begun.
