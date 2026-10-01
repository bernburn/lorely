# Lorely — Product & Engineering Specification

**Version:** 1.0 — Hackathon MVP  
**Status:** Active source of truth

Lorely is an AI-powered narrative learning and reading companion that transforms educational modules into engaging, personalized, serialized stories while preserving the concepts students are expected to learn.

Codex and other contributors should read this document before making significant implementation decisions.

---

# 1. Specification Change Policy

This specification may evolve during development.

When requirements change:

1. Preserve existing working functionality unless the new requirement explicitly replaces it.
2. Do not rebuild unrelated architecture simply because this document changed.
3. Before changing database schemas, API contracts, routing, or persisted data, identify the impact first.
4. Prefer backward-compatible changes where practical.
5. If stored data requires migration, create an explicit migration plan rather than silently changing its meaning.
6. New requirements take precedence over older conflicting requirements.
7. Use Git history to track specification changes.

---

# 2. Product Problem

Many students can willingly read hundreds or thousands of chapters of stories they enjoy, but become bored quickly when reading traditional educational modules.

Lorely attempts to bridge that gap.

Instead of merely summarizing a lesson, Lorely transforms the educational material into a narrative experience tailored to the student's reading preferences.

The educational content remains the source of truth.

---

# 3. Core Product Flow

The main experience is:

**Upload Lesson**

→ **Personalize Experience**

→ **Generate Story**

→ **Read**

→ **Interact**

→ **Check Understanding**

→ **Unlock Next Chapter**

Lorely also supports serialized learning:

**Module 1 → Story Arc 1**

**Module 2 → Story Arc 2**

**Module 3 → Story Arc 3**

A student can therefore continue the same characters and fictional world while progressing through new educational topics.

---

# 4. Product Boundaries

Lorely is not intended to be:

- a generic chatbot
- an essay generator
- a homework-answering service
- a generic story generator
- a flashcard platform
- an LMS
- school management software
- a teacher analytics dashboard
- a collection of unrelated AI features

The hackathon MVP remains focused on:

> **Turning educational material into engaging serialized narrative learning experiences.**

---

# 5. Technology Stack

## Frontend

- React
- Vite
- TypeScript
- React Router
- Lucide React

## Backend

- Python
- FastAPI
- Pydantic
- pydantic-settings

## Database

- MongoDB

Use a current officially supported MongoDB Python driver/API.

Avoid deprecated database libraries where a supported alternative exists.

## PDF Processing

- pypdf

OCR is outside the MVP.

## AI / LLM

- Gemini Developer API
- official current Google GenAI Python SDK
- `google-genai`
- default model: `gemini-3.8-flash`

The model must be configurable using an environment variable rather than hardcoded throughout the application.

---

# 6. Repository Structure

Lorely uses one Git repository containing both frontend and backend.

Recommended structure:

    Lorely/
    │
    ├── LORELY_SPEC.md
    ├── README.md
    ├── .gitignore
    │
    ├── frontend/
    │   ├── src/
    │   │   ├── components/
    │   │   ├── pages/
    │   │   ├── services/
    │   │   ├── types/
    │   │   ├── data/
    │   │   ├── styles/
    │   │   ├── App.tsx
    │   │   └── main.tsx
    │   ├── package.json
    │   ├── .env.example
    │   └── vercel.json
    │
    └── backend/
        ├── app/
        │   ├── main.py
        │   ├── config.py
        │   ├── database.py
        │   │
        │   ├── api/
        │   │   ├── health.py
        │   │   ├── lessons.py
        │   │   ├── stories.py
        │   │   └── series.py
        │   │
        │   ├── schemas/
        │   │   ├── lesson.py
        │   │   ├── story.py
        │   │   └── series.py
        │   │
        │   ├── services/
        │   │   ├── pdf_service.py
        │   │   ├── ai_service.py
        │   │   ├── story_service.py
        │   │   └── series_service.py
        │   │
        │   ├── prompts/
        │   │   ├── story_generation.py
        │   │   └── story_continuation.py
        │   │
        │   └── data/
        │       └── sample_lesson.py
        │
        ├── requirements.txt
        ├── .env
        └── .env.example

This structure may be adjusted when there is a clear technical reason.

Do not over-engineer the project.

---

# 7. Environment Configuration

The application should require no source-code modifications to configure Gemini or MongoDB.

Create:

`backend/.env.example`

with:

    GEMINI_API_KEY=
    GEMINI_MODEL=gemini-3.8-flash

    MONGODB_URI=
    MONGODB_DB_NAME=lorely

    FRONTEND_URL=http://localhost:5173

The real:

`backend/.env`

contains the developer's actual credentials and MUST NOT be committed.

The intended setup is simply:

1. copy/open `backend/.env`
2. paste Gemini API key
3. paste MongoDB URI
4. run backend

Use `pydantic-settings` through a centralized configuration module such as:

`backend/app/config.py`

Do not scatter `os.getenv()` calls throughout the code.

Never log API keys, passwords, or complete MongoDB connection strings.

---

# 8. Frontend Environment

Create:

`frontend/.env.example`

with:

    VITE_API_BASE_URL=http://localhost:8000

The frontend should use `VITE_API_BASE_URL` for FastAPI.

During local development, it may safely default to:

`http://localhost:8000`

Never place these in frontend environment variables:

- Gemini API keys
- MongoDB connection strings
- database passwords
- backend secrets

Anything prefixed with `VITE_` may be visible to users.

The browser communicates only with FastAPI.

FastAPI communicates with Gemini and MongoDB.

---

# 9. Deployment Architecture

The repository remains a monorepo.

## Frontend

Designed to be deployable to Vercel.

When connecting the repository to Vercel:

**Root Directory:** `frontend`

The production frontend should use:

    VITE_API_BASE_URL=https://YOUR_BACKEND_URL

Because Lorely uses React Router routes such as:

    /read/:arcId
    /continue/:seriesId

include SPA rewrite configuration such as `frontend/vercel.json` so refreshing a nested route does not return a Vercel 404.

## Backend

The FastAPI backend may be deployed independently to a suitable Python hosting provider.

Production backend configuration should include:

    FRONTEND_URL=https://YOUR_VERCEL_DOMAIN

FastAPI CORS must use the configured frontend origin rather than allowing arbitrary origins unnecessarily.

---

# 10. Core Educational Principle

Educational accuracy has higher priority than storytelling creativity.

Lorely may use:

- fiction
- allegory
- metaphor
- analogy
- personification
- fictional characters
- fictional settings
- mysteries
- adventure
- roleplay
- second-person narration
- cliffhangers

But Lorely must not intentionally teach false information.

Important terminology from the lesson must remain recognizable when the student is expected to learn those terms.

Example source:

> A router forwards packets between computer networks.

Acceptable Grounded version:

> Mira opened the router's routing table to discover why the packet could not reach the destination network.

Acceptable Allegory version:

> Sir Router unfolded his Routing Table and examined the destination IP Address carried by Packet.

Unacceptable when the terminology matters:

> The magical Gatekeeper inspected the Message Spirit's Soul Number.

The story may simplify explanations.

It must not replace required academic vocabulary with inaccurate terminology.

---

# 11. Story Quality

Lorely must create actual stories.

Do not force educational terminology into every sentence.

Bad:

> Router walked toward Packet while Switch spoke with IP Address as Routing Table watched nearby.

This feels like a textbook wearing a fictional costume.

Stories should instead contain:

- characters
- motivations
- relationships
- goals
- conflict
- tension
- discoveries
- consequences
- mysteries where appropriate
- meaningful progression
- cliffhangers

Educational concepts should naturally create:

- rules
- problems
- obstacles
- clues
- decisions
- solutions

The student should want to know what happens next.

---

# 12. Personalization

Lorely supports the following preferences.

## Genre

- Fantasy
- Mystery
- Sci-Fi
- Adventure
- Horror

## Story Style

- Allegory
- Grounded
- You Decide

## Core Plot

Optional user-written story premise.

Maximum approximately 500 characters.

## Interaction Mode

- Just Read
- Solve Along

## Tone

- Lighthearted
- Serious
- Funny
- Dramatic

## Story Length

- Quick
- Standard
- Long

## Education Level

- Elementary
- Junior High
- Senior High
- College

## Story Complexity

- Easy to Read
- Balanced
- Advanced

---

# 13. Default Preferences

Use sensible defaults so students do not have to configure everything.

    Genre: Adventure
    Story Style: Grounded
    Interaction: Just Read
    Tone: Dramatic
    Length: Standard
    Education Level: Senior High
    Story Complexity: Balanced
    Core Plot: empty

After selecting a lesson, the student should be capable of immediately generating a story using these defaults.

---

# 14. Genre vs Story Style

These must remain separate.

Genre answers:

> What kind of story is this?

Examples:

Fantasy, Mystery, Sci-Fi.

Story Style answers:

> How does the lesson become part of the narrative?

Options:

Allegory, Grounded, You Decide.

Keep them separate in:

- frontend state
- TypeScript types
- backend schemas
- MongoDB
- Gemini prompts

---

# 15. Story Style — Allegory

Allegory may use:

- metaphor
- personification
- symbolic characters
- symbolic objects
- symbolic locations
- fictional systems
- fictional laws/rules

Educational concepts may become part of the fictional world.

Example:

> Sir Router stood at the crossroads while Packet waited beside him.
>
> Router examined the destination IP Address written across Packet's envelope before opening his Routing Table.

Required academic terminology should remain recognizable.

Student description:

> **Allegory**  
> Turn lesson concepts into characters, places, objects, and parts of the story world.

---

# 16. Story Style — Grounded

Grounded uses fictional characters and situations while educational concepts remain their real-world counterparts.

Example:

> Mira stared at the failed transmission.
>
> The destination IP Address was correct, so she opened the router's routing table.

Router means an actual router.

Packet means an actual packet.

Student description:

> **Grounded**  
> Follow characters using lesson concepts in realistic situations.

---

# 17. Story Style — You Decide

You Decide uses second-person narration.

The reader becomes the protagonist.

Example:

> Your screen flashes red.
>
> PACKET DELIVERY FAILED.
>
> The destination IP Address appears correct.
>
> You open the network diagram.

You Decide is independent from Solve Along.

## You Decide + Just Read

Second-person narrative with no mid-story quiz interruptions.

## You Decide + Solve Along

Second-person narrative with meaningful decisions during the story.

Student description:

> **You Decide**  
> Step into the story as the main character.

---

# 18. Core Plot

Core Plot is optional.

UI:

**Core Plot**

**Optional**

Helper text:

> Have a story idea? Give Lorely a premise to build around.

Placeholder:

> A group of students discovers something strange happening on their school's network...

Do not call it:

- AI Prompt
- Prompt Engineering
- System Prompt

The user should simply describe the story they want.

Priority:

1. Educational accuracy
2. Required lesson concepts
3. Story Style
4. Core Plot
5. Genre
6. Tone and presentation preferences

If the Core Plot conflicts with the lesson:

adapt the plot.

Never change educational facts to satisfy the story.

---

# 19. Just Read

Just Read means the narrative flows without educational questions interrupting the chapter.

However:

**Every chapter must end with required comprehension question(s).**

The student cannot proceed until all required chapter questions are answered correctly.

Flow:

**Read**

→ **Check Your Understanding**

→ incorrect: **Hint + Retry**

→ correct: **Explanation**

→ **Unlock Next Chapter**

Student description:

> **Just Read**  
> Enjoy the story without interruptions, then answer a question at the end of each chapter to continue.

---

# 20. Solve Along

Solve Along includes everything from Just Read.

Additionally, the story may stop at meaningful moments before the character solves an educational problem.

Example:

> Mira confirmed that the destination IP Address was correct.
>
> The packet still couldn't reach the archive network.
>
> What should she inspect next?

Possible choices:

- Router's routing table
- Monitor resolution
- Username
- File name

Correct answers should continue the story naturally.

Incorrect answers should provide context and a hint.

Do not insert decisions randomly.

They should feel like:

> the reader is helping solve the story

rather than:

> the student was interrupted by an exam.

Student description:

> **Solve Along**  
> Help solve problems during the story, then answer a question at the end of each chapter to continue.

---

# 21. Incorrect Answers

Never use hostile feedback such as:

- WRONG!
- FAILED!
- 0 POINTS!

Prefer:

> Not quite.

Then provide:

- contextual feedback
- a useful hint
- another attempt

Do not immediately reveal the correct answer after the first incorrect attempt.

Where helpful provide:

**Review Concept**

---

# 22. Correct Answers

After a correct answer:

show a concise explanation.

Example:

> Correct. The router needed a route to the destination network. Since that network was missing from its routing table, the packet could not be forwarded correctly.

Then unlock:

**Continue to Chapter 2**

---

# 23. Education Level

Education Level controls educational depth.

It influences:

- assumed background knowledge
- explanation depth
- examples
- academic vocabulary
- conceptual difficulty
- quiz difficulty

It must not remove terminology explicitly taught by the source.

If a lesson teaches:

**IP Address**

Lorely still uses:

**IP Address**

even when explaining it more simply.

---

# 24. Story Complexity

Story Complexity controls the prose.

It influences:

- sentence length
- sentence structure
- narrative complexity
- general vocabulary
- descriptive detail
- pacing

Example:

**College + Easy to Read**

means:

college-level concepts presented through clearer prose.

Do not simplify away required academic material.

---

# 25. Story Length

Use practical generation targets.

## Quick

- approximately 2 chapters
- around 300–450 story words per chapter
- approximately 1 required chapter question

## Standard

- approximately 3 chapters
- around 450–650 story words per chapter
- approximately 1–2 required chapter questions

## Long

- approximately 4 chapters
- around 600–800 story words per chapter
- approximately 1–2 required chapter questions

These are targets rather than exact limits.

Prioritize quality and reasonable generation latency.

---

# 26. Story Series and Story Arcs

Lorely supports continuing a story using new modules.

Hierarchy:

**Story Series**

→ **Story Arc**

→ **Chapters**

Example:

## The Unknown Device

### Arc 1
Introduction to Computer Networks

### Arc 2
Network Security

### Arc 3
Firewalls and Access Control

Each lesson creates a new Story Arc.

---

# 27. Create New vs Continue

## Create New Story

Creates:

- new Story Series
- new narrative world
- new characters where appropriate
- Arc 1

## Continue This Story

Creates:

- next Story Arc
- same Story Series
- established characters/world
- narrative continuity
- a new lesson as the educational focus

At Arc completion display:

**Continue This Story**

**Create Another Story**

**Read Again**

---

# 28. Continuation Preferences

When continuing, preserve narrative identity.

Inherited/read-only:

- Genre
- Story Style

Editable for the next Arc:

- Interaction Mode
- Tone
- Length
- Education Level
- Story Complexity
- Core Plot

Use previous Arc values as defaults where appropriate.

---

# 29. Story Bible

Do not resend every old chapter to Gemini when continuing a story.

Maintain a compact structured Story Bible.

Example:

    {
      "overallPremise": "...",
      "setting": "...",
      "characters": [],
      "relationships": [],
      "importantEvents": [],
      "establishedStoryFacts": [],
      "unresolvedThreads": [],
      "currentState": "...",
      "toneNotes": "..."
    }

Possible character shape:

    {
      "name": "Mira",
      "role": "Student",
      "traits": ["analytical", "persistent"],
      "relationships": [],
      "importantHistory": []
    }

The Story Bible is narrative memory.

It is NOT educational source material.

---

# 30. Continuing a Story

For a new Arc Gemini receives:

- NEW lesson
- Story Bible
- previous Arc summary when useful
- current preferences
- optional new Core Plot

The new lesson remains the educational source of truth.

Gemini should preserve:

- characters
- relationships
- world
- major past events
- unresolved plot threads

The new Arc should still have:

- its own educational focus
- its own conflict
- its own progression
- its own climax

Do not unnecessarily retell previous Arcs.

---

# 31. Continuity Update

A generated Arc should also return structured continuity information.

Approximately:

    {
      "arcSummary": "...",
      "newCharacters": [],
      "characterUpdates": [],
      "importantEvents": [],
      "newEstablishedFacts": [],
      "resolvedThreads": [],
      "unresolvedThreads": [],
      "currentState": "..."
    }

The backend uses this to update the Story Bible.

Avoid an extra Gemini call purely to summarize continuity when the generation response can provide it.

---

# 32. Gemini Structured Output

Gemini must produce schema-constrained structured output.

Use Pydantic models and the supported structured-output mechanism.

Flow:

**Lesson**

+

**Preferences**

+

**Lorely Generation Instructions**

+

**Optional Story Bible**

→ **Gemini**

→ **Structured Result**

→ **Pydantic Validation**

→ **MongoDB**

Do not rely on arbitrary prose followed by fragile JSON extraction.

If output validation fails:

1. retry/repair once
2. validate again
3. return a clean failure if still invalid

Never expose raw model responses or stack traces to the frontend.

---

# 33. AI Prompt Files

Store generation instructions separately.

Use:

`backend/app/prompts/story_generation.py`

and:

`backend/app/prompts/story_continuation.py`

Do not bury enormous prompt strings inside FastAPI route functions.

Prompts must emphasize:

- source grounding
- educational accuracy
- terminology preservation
- storytelling quality
- selected Genre
- Story Style
- Core Plot
- Interaction Mode
- Tone
- Length
- Education Level
- Story Complexity
- concepts
- chapter structure
- Solve Along decisions
- required comprehension questions
- continuity

Do not request or expose hidden chain-of-thought.

---

# 34. Story Arc Result

Conceptual shape:

    {
      "title": "...",
      "summary": "...",
      "concepts": [],
      "chapters": [],
      "continuityUpdate": {}
    }

---

# 35. Educational Concepts

Conceptual shape:

    {
      "id": "router",
      "term": "Router",
      "definition": "A networking device that forwards packets between networks.",
      "storyContext": "Mira investigates the router after the archive server becomes unreachable."
    }

Definitions should remain grounded in the uploaded lesson wherever practical.

Avoid unnecessary unsupported academic claims.

---

# 36. Story Chapters

Conceptual shape:

    {
      "chapterNumber": 1,
      "title": "The Message That Never Arrived",
      "blocks": [],
      "endQuiz": []
    }

---

# 37. Story Blocks

Paragraph:

    {
      "type": "paragraph",
      "text": "..."
    }

Decision:

    {
      "type": "decision",
      "prompt": "...",
      "choices": ["...", "..."],
      "correctIndex": 0,
      "hint": "...",
      "explanation": "...",
      "relatedConceptIds": []
    }

Just Read should normally contain only paragraph blocks.

Solve Along may include a small number of Decision blocks where educationally meaningful.

---

# 38. Quiz Questions

Conceptual shape:

    {
      "question": "...",
      "choices": ["...", "..."],
      "correctIndex": 0,
      "hint": "...",
      "explanation": "...",
      "relatedConceptIds": []
    }

Questions should test understanding.

Good:

> Why couldn't the router forward the packet to the archive network?

Bad:

> What word appeared in paragraph four?

Only assess concepts actually introduced by the lesson/story.

---

# 39. PDF Upload

Implement real PDF upload.

Suggested endpoint:

`POST /api/lessons/upload`

Use multipart/form-data.

Validate:

- extension
- MIME type where practical
- size
- readability

Use pypdf.

Extract page by page.

Preserve:

- page number
- page text

Also combine into:

`extracted_text`

Do not permanently store the raw PDF.

Process in memory or temporary storage and dispose afterward.

---

# 40. PDF MVP Limits

No OCR.

If insufficient selectable text exists, return:

> We couldn't read enough text from this PDF. It may contain scanned pages instead of selectable text.

Practical centralized limits:

    MAX_FILE_SIZE = 10 MB
    MAX_PAGES = 80
    MAX_EXTRACTED_CHARACTERS = 200000

These can be adjusted when justified.

Do not silently truncate oversized lessons.

---

# 41. Lesson Database Model

Approximately:

    {
      "_id": "...",
      "filename": "...",
      "page_count": 0,
      "character_count": 0,
      "pages": [
        {
          "page_number": 1,
          "text": "..."
        }
      ],
      "extracted_text": "...",
      "status": "ready",
      "created_at": "..."
    }

The raw PDF is not stored permanently.

---

# 42. Story Series Model

Approximately:

    {
      "_id": "...",
      "title": "...",
      "genre": "Mystery",
      "storytelling_style": "Grounded",
      "story_bible": {},
      "arc_ids": [],
      "created_at": "...",
      "updated_at": "..."
    }

---

# 43. Story Arc Model

Approximately:

    {
      "_id": "...",
      "series_id": "...",
      "lesson_id": "...",
      "arc_number": 1,

      "preferences": {
        "genre": "...",
        "storytelling_style": "...",
        "interaction_mode": "...",
        "tone": "...",
        "length": "...",
        "education_level": "...",
        "complexity": "...",
        "core_plot": "..."
      },

      "title": "...",
      "summary": "...",
      "concepts": [],
      "chapters": [],
      "continuity_update": {},
      "created_at": "..."
    }

Correctly serialize MongoDB ObjectIds in API responses.

---

# 44. Authentication

Authentication is NOT part of the hackathon MVP.

Do not implement:

- login
- accounts
- passwords
- user profiles

Because there are no accounts, do not expose a public endpoint/UI that simply lists every story in the MongoDB database.

Instead, use browser localStorage to remember Story Series IDs created/accessed in that browser.

---

# 45. Local Browser State

Use localStorage for lightweight local state such as:

- known Story Series IDs
- current Arc
- current chapter
- completed chapter checks

Do not store secrets.

Actual Story content remains in MongoDB.

---

# 46. Sample Lesson

Include a built-in sample lesson:

**Introduction to Computer Networks**

It should teach:

- computer networks
- packets
- IP addresses
- routers
- routing tables
- switches

The sample should be long enough for meaningful generation but short enough for fast demo generation.

Provide:

**Try a Sample Lesson**

The sample uses the same real Gemini generation pipeline as uploaded lessons.

Do not secretly substitute a pre-generated story when Gemini is available.

---

# 47. API

Suggested endpoints:

    GET  /api/health

    POST /api/lessons/upload
    POST /api/lessons/sample

    POST /api/stories/generate

    POST /api/series/{series_id}/continue

    GET  /api/arcs/{arc_id}
    GET  /api/series/{series_id}

Do not provide an unrestricted endpoint that exposes all stories in the database.

---

# 48. New Story Generation

The endpoint should:

1. validate request
2. retrieve lesson
3. generate structured Arc with Gemini
4. validate response
5. retry once if malformed
6. create Story Series
7. create Arc 1
8. initialize Story Bible
9. persist data
10. return Series ID and Arc ID

Do not report success if persistence fails.

---

# 49. Story Continuation

Continuation should:

1. validate Series ID
2. validate new Lesson ID
3. retrieve Story Series
4. retrieve Story Bible
5. calculate next Arc number
6. combine new lesson + continuity + preferences + Core Plot
7. call Gemini
8. validate result
9. persist new Arc
10. update Story Bible
11. update Series
12. return new Arc ID

Do not resend all historical chapter text unless genuinely necessary.

---

# 50. Health Endpoint

`GET /api/health`

May return:

    {
      "status": "ok",
      "database": "connected",
      "ai": "configured"
    }

Do not expose secret values.

The endpoint does not need to invoke Gemini every time.

---

# 51. Frontend API Layer

Centralize API calls.

Potential functions:

    uploadLesson()
    useSampleLesson()
    generateStory()
    continueStory()
    getArc()
    getSeries()

Do not scatter backend URLs throughout React components.

---

# 52. Frontend Routes

Primary routes:

    /
    /create
    /read/:arcId
    /continue/:seriesId

Provide a polished Not Found screen.

---

# 53. Brand

Brand name:

**Lorely**

Use a simple typographic wordmark.

Do not create:

- a mascot
- a complicated logo
- robot imagery
- sparkle-heavy AI branding

Do not repeatedly display:

- AI Powered
- Powered by AI
- Smart AI

The functionality already communicates that AI is involved.

---

# 54. UI Design Direction

Lorely must not look like generic AI-generated SaaS design.

Avoid:

- blue-purple neon gradients
- giant gradient blobs
- glowing buttons
- excessive glassmorphism
- excessive blur
- giant rounded cards everywhere
- every section inside a card
- meaningless metrics
- decorative charts
- sparkle icons
- robot imagery
- rainbow palettes
- huge pill controls
- massive empty hero areas
- floating abstract blobs
- excessive drop shadows
- holographic/futuristic styling
- excessive animation

Lorely should feel like:

> a polished modern reading product for students

not:

> a generic AI startup template.

---

# 55. Visual Inspiration

Use restraint inspired by well-designed:

- editorial reading products
- Kindle
- Medium
- Readwise Reader
- Notion
- Linear

Do not directly copy them.

Focus on:

- typography
- hierarchy
- whitespace
- readability
- alignment
- consistency
- restraint

Lorely should feel:

- modern
- warm
- editorial
- intelligent
- youthful
- calm
- polished
- focused

---

# 56. Colors

Suggested direction:

Background:

warm off-white / paper-like neutral

Primary text:

near-black / ink

Secondary:

muted gray

Borders:

subtle neutral gray

Accent:

restrained deep/forest green

No neon.

No purple simply because the product uses AI.

No gradient CTA buttons.

Use CSS variables/design tokens.

---

# 57. Typography

Use a clean modern sans-serif for interface UI.

A readable serif may be used for story body text.

Optimize story typography for:

- comfortable line length
- line height
- font size
- paragraph spacing
- long-form reading

Desktop story width:

approximately 680–760px

Mobile horizontal spacing:

approximately 18–24px

Avoid giant startup-style headings.

---

# 58. Landing Page

Keep the landing page concise.

Navbar:

**Lorely**                                 **Create**

Hero:

> **Turn your lessons into stories.**

Supporting text:

> Upload a school module and transform the same concepts into a story built around how you like to read.

Primary:

**Transform a Lesson**

Secondary:

**See an Example**

Then a restrained three-step explanation:

**Upload**  
Your lesson

**Personalize**  
Your experience

**Read**  
And learn

Optionally show:

### Original

> A router forwards packets between networks.

### Story

> Mira opened the router's routing table to discover why the packet couldn't reach the archive network.

If localStorage contains existing series, optionally show a small:

**Continue Reading**

section.

Do not create a dashboard.

---

# 59. Create Story Page

Route:

`/create`

Heading:

> **Create your story**

Supporting copy:

> Upload your lesson and choose how you'd like to experience it.

Structure:

1. Upload Lesson
2. Choose Your Experience
3. Create Story

No sidebar.

Avoid enterprise-dashboard styling.

---

# 60. Upload UI

Support:

- click upload
- drag/drop
- PDF only

States:

- Uploading...
- Reading lesson...
- Lesson ready

Successful state should show:

- filename
- page count
- file size where available
- Change
- Remove

Also provide:

**Try a Sample Lesson**

---

# 61. Preference UI

Keep controls compact.

Do not create gigantic cards for every choice.

Use restrained selectable controls and small descriptive panels where necessary.

Core Plot:

**Optional**

Helper:

> Have a story idea? Give Lorely a premise to build around.

Maximum approximately 500 characters.

---

# 62. Generation UI

While the real request is running, show restrained rotating messages such as:

- Reading your lesson...
- Finding the important concepts...
- Planning the story...
- Building the narrative...
- Preparing your chapters...

For continuation:

- Continuing your story...

Do not display fake percentages.

Do not intentionally delay the request.

Prevent duplicate submissions.

---

# 63. Story Reader

This is Lorely's most important screen.

It should feel like a modern digital book.

It should NOT resemble:

- ChatGPT
- a chatbot
- a dashboard
- an AI response card

Use a centered reading column.

Example:

**The Unknown Device**

Arc 2 · Chapter 1

Mystery · Grounded · Senior High

**The Breach**

Based on: Network Security

Keep metadata restrained.

---

# 64. Concept Highlighting

Important concepts should be subtly interactive.

Examples:

Router  
Packet  
IP Address  
Routing Table

Use:

- restrained accent
- subtle underline
- hover treatment

Do not render them as large buttons.

Do not use `dangerouslySetInnerHTML` merely to add concept highlighting.

Use safe React text rendering/tokenization.

---

# 65. Concept Panel

Clicking a term shows:

## Router

### Lesson Definition

> A networking device that forwards packets between computer networks.

### In This Story

> Mira investigates the router after packets fail to reach the archive server.

Clearly distinguish factual educational meaning from narrative context.

Desktop:

side panel/popover

Mobile:

bottom sheet/modal

Provide:

**View Concepts**

Do not turn this into a full flashcard system.

---

# 66. Solve Along UI

Decision blocks appear naturally inside the reading flow.

Correct:

continue narrative.

Incorrect:

> Not quite.

Then provide hint and retry.

Do not make the experience resemble a generic form or survey.

---

# 67. End-of-Chapter Check

Every chapter displays:

**Check Your Understanding**

The next chapter remains locked until all required questions are correct.

Incorrect:

- contextual feedback
- hint
- retry

Correct:

- concise explanation
- unlock progression

---

# 68. Chapter Navigation

Keep navigation simple:

**Previous**

**Chapter X of Y**

**Continue / Next**

Next remains disabled until chapter requirements are complete.

Include subtle reading progress.

Do not add:

- XP
- coins
- streaks
- achievements
- levels
- leaderboards

---

# 69. Arc Completion

At the end of an Arc display:

> **You finished this story arc.**

Show:

- concepts explored
- questions completed
- source lesson

Actions:

**Continue This Story**

**Create Another Story**

**Read Again**

Do not imply the entire Story Series has ended.

---

# 70. Continue Story Page

Route:

`/continue/:seriesId`

Heading:

> **Continue your story**

Show:

- Series title
- current Arc count
- inherited Genre
- inherited Story Style

Then:

> **Add your next lesson**

Allow:

- PDF upload
- sample lesson

Provide:

**Core Plot for this Arc**

Helper:

> Have an idea for what should happen next?

Editable preferences:

- Interaction
- Tone
- Length
- Education Level
- Story Complexity

Primary CTA:

**Continue Story**

---

# 71. Responsive Design

Lorely must be intentionally designed for:

- desktop
- tablet
- mobile

Mobile must support:

- no horizontal overflow
- comfortable reading typography
- touch-friendly quiz choices
- sensible preference stacking
- usable Core Plot field
- accessible concept panels
- clear chapter navigation

Do not simply shrink desktop UI.

---

# 72. Accessibility

Use:

- semantic HTML
- actual buttons
- labels
- keyboard navigation
- visible focus states
- sufficient contrast
- accessible modals/dialogs
- appropriate ARIA where useful

Quiz and Decision choices must work without a mouse.

---

# 73. Error Handling

Handle at minimum:

- wrong file type
- invalid PDF
- scanned/no-text PDF
- oversized PDF
- excessive page count
- backend unavailable
- MongoDB unavailable
- invalid MongoDB URI
- missing Gemini key
- Gemini rate limit/quota
- Gemini timeout
- malformed structured result
- generation failure
- continuation failure
- invalid Arc ID
- invalid Series ID
- network errors

Never expose:

- Python traceback
- raw secrets
- complete MongoDB URI
- raw API objects
- massive raw model outputs

Use understandable messages.

---

# 74. Responsible AI

Show unobtrusive copy:

> Lorely uses AI to transform educational material. Important information can always be compared with your original lesson.

Do not make absolute claims that generated educational content is always correct.

---

# 75. File Privacy

The original uploaded PDF is not permanently stored.

Extracted lesson text is stored in MongoDB.

It is acceptable to say:

> The original uploaded PDF file is not permanently stored.

Do not say:

> We never store your lesson.

because that would be inaccurate.

---

# 76. Security

Gemini credentials:

backend only.

MongoDB credentials:

backend only.

Use `FRONTEND_URL` for CORS.

Validate requests with Pydantic.

Validate MongoDB IDs.

Never expose internal settings through APIs.

Never commit real `.env` files.

---

# 77. README

Create a root `README.md` containing:

- Lorely concept
- problem being solved
- Story Styles
- Interaction Modes
- Core Plot
- Story Series and Story Arcs
- continuation system
- Education Level
- Story Complexity
- stack
- architecture
- Gemini setup
- MongoDB setup
- PDF limitations
- environment variables
- exact local startup instructions
- deployment notes
- demo flow
- known MVP limitations

README should be simpler than this specification.

---

# 78. Git Ignore

Ignore:

    backend/.env
    frontend/.env
    .env

    .venv/
    venv/
    __pycache__/
    *.pyc
    .pytest_cache/

    frontend/node_modules/
    frontend/dist/

    .DS_Store
    Thumbs.db

Do NOT ignore:

- `.env.example`
- `LORELY_SPEC.md`
- `README.md`

---

# 79. Testing

Do not stop after writing code.

Frontend verification should include:

- dependency installation
- TypeScript compilation
- production build
- routes
- major interactions

Backend verification should include:

- imports
- FastAPI startup
- health endpoint
- PDF validation
- PDF extraction
- Pydantic models
- invalid IDs
- clean errors

When credentials are available, also test:

- MongoDB
- sample lesson persistence
- Gemini structured generation
- Series creation
- Arc creation
- Story Bible initialization
- story retrieval
- continuation
- Story Bible update

Never claim an integration was tested when credentials or network access were unavailable.

---

# 80. Definition of Done — New Story

A complete new Story flow is:

1. Open Lorely.
2. Click **Transform a Lesson**.
3. Upload PDF or use sample lesson.
4. Backend extracts/stores lesson.
5. Configure narrative preferences.
6. Optionally enter Core Plot.
7. Click **Create Story**.
8. Backend retrieves lesson.
9. Gemini generates structured Arc data.
10. Pydantic validates it.
11. Story Series is created.
12. Arc 1 is created.
13. Story Bible is initialized.
14. Data persists to MongoDB.
15. Frontend receives Arc ID.
16. Navigate to `/read/:arcId`.
17. Story renders as long-form reading.
18. Educational concepts are interactive.
19. Solve Along decisions work when enabled.
20. Chapter-end checks appear.
21. Wrong answers provide hint/retry.
22. Correct answers unlock progression.
23. Final chapter reaches Arc completion.

---

# 81. Definition of Done — Continuation

A complete continuation flow is:

1. Complete an Arc.
2. Click **Continue This Story**.
3. Open `/continue/:seriesId`.
4. Load existing Series.
5. Upload NEW module.
6. Genre and Story Style remain inherited.
7. Optionally enter new Core Plot.
8. Adjust permitted Arc-level preferences.
9. Backend loads new lesson + Story Bible.
10. Gemini generates next Arc.
11. Existing world and characters remain coherent.
12. New module becomes the educational focus.
13. Structured output validates.
14. New Arc persists.
15. Story Bible updates.
16. Series updates.
17. Navigate to new `/read/:arcId`.

---

# 82. Hackathon Demo Path

Recommended presentation flow:

1. Open Lorely.
2. Click **Transform a Lesson**.
3. Choose **Try a Sample Lesson**.
4. Show personalization.
5. Select:
   - Mystery
   - Grounded
   - Solve Along
6. Optionally enter Core Plot.
7. Generate.
8. Show real generation loading state.
9. Enter generated Story Reader.
10. Click a concept.
11. Demonstrate Solve Along.
12. Reach chapter-end question.
13. Answer incorrectly once.
14. Show hint.
15. Answer correctly.
16. Show next chapter unlock.
17. If presentation time permits, show **Continue This Story** and explain Story Arcs.

---

# 83. MVP Non-Goals

Do not add during the hackathon:

- authentication
- user accounts
- teacher accounts
- subscriptions
- payments
- generic chatbot
- essay generation
- homework solving
- flashcards
- analytics dashboards
- comments
- social features
- leaderboards
- XP
- achievements
- streaks
- mascot
- complex logo
- OCR
- text-to-speech
- voice
- image generation

---

# 84. Implementation Phases

Lorely should be built incrementally.

## Phase 1 — Foundation + Lessons

Implement:

- repository structure
- React/Vite/TypeScript foundation
- FastAPI foundation
- `.env` configuration
- MongoDB connection
- PDF upload
- PDF extraction
- Lesson persistence
- sample lesson
- lesson APIs
- health endpoint

Verify this phase before proceeding.

## Phase 2 — AI + Narrative Engine

Implement:

- Gemini service
- structured Pydantic generation
- Story Blocks
- concepts
- chapter quizzes
- Allegory
- Grounded
- You Decide
- Just Read
- Solve Along
- Core Plot
- Education Level
- Story Complexity
- Story Series
- Story Arc
- Story Bible
- new-story generation
- continuation generation

Use sample lesson for testing.

## Phase 3 — Frontend Product Experience

Implement:

- polished landing page
- upload experience
- personalization UI
- Core Plot UI
- generation UI
- Story Reader
- concept interactions
- Solve Along
- chapter checks
- chapter locking
- Arc completion
- continuation page
- browser reading progress

Connect everything to real APIs.

## Phase 4 — End-to-End Repair + Demo Polish

Verify and polish:

- uploaded PDF flow
- sample flow
- Gemini generation
- reading
- concepts
- quizzes
- continuation
- Story Bible
- mobile
- accessibility
- deployment behavior
- loading
- error handling

Do not add unrelated features during this phase.

---

# 85. Codex Working Rules

When working on Lorely:

1. Read `LORELY_SPEC.md` first.
2. Inspect existing code before changing architecture.
3. Preserve working functionality.
4. Implement only the requested Phase/task.
5. Do not silently remove requirements.
6. Do not add unrelated features.
7. Run relevant builds/tests.
8. Fix problems discovered by those checks.
9. Never invent credentials.
10. Never claim an external integration was tested when it was not.
11. Clearly report remaining limitations.
12. Prefer understandable reliable code over unnecessary abstraction.
13. Prioritize hackathon reliability over enterprise complexity.
14. Keep educational accuracy above narrative creativity.
15. Keep the UI restrained and intentionally designed.

---

# 86. Final Product Summary

Lorely ultimately provides:

**PDF / Lesson**

→ **Genre**

→ **Story Style**

→ **Optional Core Plot**

→ **Interaction**

→ **Education + Writing Preferences**

→ **Gemini**

→ **Story Series**

→ **Story Arc**

→ **Interactive Reading**

→ **Comprehension-Gated Chapters**

→ **Upload Next Module**

→ **Continue the Same Story**

Core value proposition:

> **Lorely turns lessons into stories students may actually want to keep reading.**