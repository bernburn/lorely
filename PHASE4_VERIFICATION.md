# Phase 4 verification — 2026-10-02

Phase 4 code, deterministic tests, real MongoDB integration, browser checks, and deployment configuration review are complete. **Full live Gemini generation remains unverified.** The configured model passed one minimal structured request, but the full Quick request first encountered HTTP 400; verification of a smaller provider schema then encountered genuine HTTP 503 high-demand responses. No real Gemini Arc was generated or substituted with a fixture. Live continuation was not attempted.

## Gemini diagnosis and changes

The reported HTTP 200 with `output_text='H'` fails in JSON parsing inside Pydantic (`pydantic_core._pydantic_core.ValidationError`, `json_invalid`). Transport success does not imply a valid story. The SDK accepts the minimal schema and serializes the current Interactions `response_format` correctly. An offline test using the actual SDK demonstrates both complete output-text extraction and regeneration under the identical schema; there is no local first-character extraction bug.

The old minimal probe allocated only 128 output tokens. The successful 512-token probe used 155 thought tokens and 9 output tokens. **Token-budget truncation is a plausible explanation for the old one-character output, not a proven historical root cause:** its finish/usage metadata was not retained. Google documents that the output budget also includes thinking tokens: [thinking token limits](https://ai.google.dev/gemini-api/docs/thinking#token-limits-and-max_output_tokens). Story generation's existing 8192-token budget was preserved. The opt-in minimal verification script now sends exactly once with a 512-token budget, without transport retry or structured repair.

A confirmed application bug was the shared three-call counter: two transient failures followed by HTTP 200 with invalid JSON exhausted the counter and skipped the promised structured regeneration. `AIService.generate` now tracks these separately:

- Normal structured generation plus **one** structured regeneration after JSON parsing, Pydantic, or Lorely business validation failure.
- **Two shared transient transport retries** across both structured attempts; the budget does not reset during regeneration.
- Maximum **four outbound calls** for a mixed failure sequence; three calls if all fail in transport.
- HTTP 429/500/502/503/504 and transport timeouts retry with 1s/2s delays plus up to 250ms jitter. Permanent errors receive no automatic retry.
- Repeated invalid output returns controlled HTTP 502. Exhausted transport failures return controlled HTTP 503 with `Retry-After: 5`.
- SDK hidden retries remain disabled and tested against the actual SDK HTTP boundary.

The regeneration prompt identifies the failing validation stage and requests a complete result under the same `response_format`; it never includes rejected output or raw error details. No JSON scraping, regex extraction, alternate model, or relaxed acceptance validation was added. Persistence begins only after schema and business validation succeed.

Generation/continuation prompts lost redundant return-shape instructions. There were no duplicated handwritten schemas, fenced example responses, or instructions to explain before returning JSON. Educational accuracy, terminology, every preference, concept/quiz requirements, Story Bible, continuity, and new-lesson focus remain. Source and memory JSON in prompts are input data and were preserved.

### Separate full-schema issue

The first real Quick request failed with SDK `BadRequestError`, HTTP 400, sanitized message **“Request contains an invalid argument.”** Model metadata confirmed the 8192 output-token budget is within its advertised limit. This is distinct from the historical HTTP 200/non-JSON failure.

To reduce constrained-decoder complexity, the provider projection removes `title` annotations and expresses array upper bounds as description guidance, alongside the existing string-limit guidance. Types, required fields, enums, references, numeric limits, minimum array sizes, nullable tagged blocks, and **all strict backend acceptance limits** remain. A regression test proves a 41-block chapter is still rejected. Google documents that large/deep structured schemas can be rejected: [structured output limitations](https://ai.google.dev/gemini-api/docs/structured-output).

This schema change is a **candidate fix**, not confirmed resolution of HTTP 400: its one full-generation verification reached only HTTP 503 high-demand errors. Successful full-schema acceptance and story quality still require live verification when this model is available.

## Real Gemini checks

| Check | Result |
| --- | --- |
| Model actually used | `gemini-3.6-flash`, from existing backend settings |
| Minimal structured request | One outbound request; HTTP 200; interaction completed; JSON/Pydantic validation passed |
| Initial Quick generation | One outbound request; HTTP 400; controlled application error; no Arc persisted |
| Candidate-schema verification | One logical Quick generation; three bounded outbound requests, each genuine HTTP 503 high demand; controlled application HTTP 503; manual Retry enabled |
| Total inference calls this run | Five: one minimal, one initial Quick, three bounded calls for candidate verification |
| Real Gemini Series / Arc / Story Bible | Not created; no generated story to validate or persist |
| Real Gemini reader smoke / continuation | Blocked / not attempted |
| Real Just Read generation | Not verified; deterministic and persisted-fixture coverage only |

The Quick form used the real saved networking sample and exactly Mystery / Grounded / Solve Along / Dramatic / Quick / Senior High / Balanced, with the requested unknown-device Core Plot. After external 503 responses, no more Gemini inference was made. Backend `.env` remained byte-for-byte unchanged; no model, key, MongoDB connection, or database-name changes were made.

## Automated regression results

- **Backend: 80 passed**, up from 70. One existing Starlette/httpx TestClient deprecation warning remains; it did not fail tests.
- **Frontend: 41 passed**, up from 40, across all three test files.
- **TypeScript: passed** (`tsc --noEmit`).
- **Production build: passed**, 1770 modules; JS 298.56 kB (94.43 kB gzip), CSS 13.37 kB (3.60 kB gzip).
- Backend imports/startup and real health endpoint passed in fresh Uvicorn processes.

New Gemini regressions cover one-character/prose/empty output, schema-invalid JSON, repaired success, business-rule repair, late transport recovery, a shared transport budget during repair, actual-SDK HTTP 200 extraction/schema retention, repeated invalid JSON returning clean 502 without persistence, and strict array limits after provider projection. Existing tests cover valid JSON, repeated repair failure, transient exhaustion, permanent authorization errors, hidden SDK retries, continuity, transaction contracts, stale continuation, and rollback behavior. These are deterministic offline tests; they do not call developer services.

Contract review covered Lesson upload/sample/detail, generation request/result, Arc/Series retrieval, continuation request/result, and errors. The frontend continuation preference type now permits omitted/null Arc-level values, matching backend inheritance behavior. Genre and Story Style remain excluded. Existing forms continue sending their selected values. No API redesign was needed.

Reader reliability regression: a confirmed Arc 404 clears the matching local Continue Reading reference; a network failure preserves it. Existing deleted-Series handling remains. Storage corruption, invalid/missing fields, outdated revisions, unavailable storage, chapter locks, finished-state restoration, safe highlighting, overlapping/whole-term matching, and quiz/Decision behavior remain covered.

## Real MongoDB integration

Normal application database-layer admin ping succeeded. `GET /api/health` returned HTTP 200:

```json
{"status":"ok","database":"connected","ai":"configured","message":null}
```

Database: **`lorely`**. AI `configured` indicates settings presence, not live generation availability.

`scripts/verify_phase2.py mongo` used explicitly deterministic AI output with **real API and MongoDB writes**. It verified Arc 1, initial Bible, meaningful Decision, quizzes/concepts, GET retrieval, Arc 2 with a new Lesson and inherited Genre/Style, Series IDs/Arc ordering, Bible updates, Just Read, transaction abort after a real insert with no partial records, and stale continuation rejection with no duplicate Arc. Retained verification IDs:

- Series: `6abec5bd982b66307660fab9`
- Arc 1: `6abec5bd982b66307660faba`
- Arc 2: `6abec5be982b66307660fabc`

Chrome separately saved a real sample and uploaded a real text-based PDF; independent database reads confirmed both Lessons persisted. Real API retrieval and refresh of previously saved **fixture-generated** Solve Along/Just Read Arcs also passed. These results prove persistence/UI integration, not successful Gemini narrative generation.

## Browser, responsive, and accessibility review

Headless Chrome completed **54 page/state checks**, including four widths (**1280, 768, 390, 320px**) and two real-API persisted-fixture reader checks. Tested pages/states: landing, create, saved Lesson, generation loading/failure, source Lesson, Solve Along reader, concept dialog, Decision hint, completion, continuation, Just Read, and Not Found.

Results: **zero detected WCAG 2 A/AA and WCAG 2.1 AA axe violations**, zero horizontal overflow in the responsive matrix, and no page script errors in those flows. Screenshots were reviewed for desktop reading width, tablet continuation, mobile dialog, and 320px error/form wrapping. Existing warm editorial layout, approximately 720px desktop reading column, and mobile spacing were preserved.

Browser interaction checks exercised the skip link, keyboard Decision selection, concept Escape/focus return, chapter unlock, refresh/progress restoration, completion, continuation navigation, and absence of Decisions in Just Read. Component tests additionally exercised wrong quiz answers/hints/retry/concept review, all-question locks, Previous, focus trapping, duplicate prevention, sanitized errors, failed/malformed responses, PDF validation/drag-drop, and storage recovery. Automated accessibility checks do not establish every assistive-technology experience.

Responsive/browser interaction checks used clearly labeled test fixtures. A separate unmocked production-preview flow exercised real generation failures. No production fixture fallback exists; the final non-Gemini browser run made **zero inference calls**.

## Deployment and security

- Vercel project root `frontend`, build `npm run build`, output `dist`; existing catch-all rewrite targets `/index.html` for nested-route refreshes. Direct local routes/refreshes passed; hosted Vercel deployment was not performed.
- All frontend requests use `VITE_API_BASE_URL`; set it to the HTTPS backend URL **before building**.
- Backend requirements include the runtime dependencies and pinned Gemini SDK. Start from `backend` with `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`, using the host's required port.
- Configure backend Gemini settings, MongoDB settings, and `FRONTEND_URL` to the exact frontend origin. CORS is restricted to that origin. MongoDB must support multi-document transactions and allow the backend's egress IP.
- Both `.env` files are ignored/untracked; both `.env.example` files are tracked. Secrets stay on the backend. Frontend code contains no Gemini key or credentialed MongoDB URI; responses do not expose settings. Unrestricted `GET /api/series` does not exist.
- Reviewed **131 Git-history text blobs** for exact current credentials and recognizable Google-key/credentialed MongoDB patterns: **no detections**. This is a bounded check, not a guarantee against every possible historical secret format. History was not rewritten.
- README now documents styles, modes, Core Plot, Series/Arcs, revised retries, opt-in verification, setup/deployment, limitations, and demo flow.

## Recommended demo sequence and remaining risk

Before presenting, successful **full Quick generation under the current schema** is still required. A minimal success alone does not prove it. Resolve model service availability first, then verify the candidate schema; if HTTP 400 recurs, its request-construction cause remains to be diagnosed. No model/key change was made here.

1. Open Lorely → Transform a Lesson → Try a Sample Lesson.
2. Select Mystery / Grounded / Solve Along / Dramatic / Quick / Senior High / Balanced.
3. Core Plot: **A group of students discovers an unknown device connected to their school's network.**
4. Create Story once; open the successfully persisted Arc.
5. Inspect a concept; answer a Decision incorrectly; read the hint; retry correctly using the keyboard.
6. Answer a chapter quiz incorrectly; review its hint/concept; retry correctly; complete every question to unlock the next chapter.
7. Refresh and confirm restored progress; finish the Arc; open Continue This Story.
8. If service availability permits, supply a small new Lesson, retain inherited Genre/Style, choose Quick, and verify the next Arc/Bible update.

Live generated-Arc content, educational quality, initial Bible, full reader smoke, and continuation remain unverified. Do not present fixture-generated stories as live Gemini results. Other MVP limits remain: no authentication/public rate limiting, no OCR, local browser progress rather than authenticated assessment, and human review of generated educational accuracy. Deployment configuration is reviewed, but no hosted release has been validated.
