# Lorely

Lorely is an AI-assisted learning platform that turns lesson material into interactive stories. Instead of presenting concepts only as static text, Lorely places them inside narrative chapters where learners make decisions, explore key terms, and answer quizzes with immediate feedback.

## Why Lorely?

Traditional lessons can feel abstract and passive. Learners may remember definitions without understanding how to apply them, while predictable assessments can reward guessing instead of comprehension.

Lorely addresses these problems by combining:

- Story-based explanations grounded in the source lesson
- Interactive decisions that require learners to apply concepts
- Chapter quizzes with hints and explanations
- Key-term highlighting and contextual definitions
- Multilingual story generation
- Browser-native text-to-speech controls
- Stable, balanced placement of correct multiple-choice answers

## How It Works

1. The user provides lesson content.
2. The user selects story preferences, including genre, style, reading mode, and language.
3. The backend sends a structured generation request to Google Gemini.
4. Gemini returns a complete educational story arc containing chapters, concepts, decisions, and quizzes.
5. The backend validates and normalizes the generated data before saving it.
6. The learner reads the story, explores concepts, completes decisions, and answers chapter quizzes.

## Core Features

### AI-Generated Story Arcs

Lorely uses Google Gemini to generate structured stories directly from lesson material. The generated story preserves required educational concepts while adapting the setting, dialogue, and narrative to the learner's preferences.

### Two Reading Modes

- **Just Read** presents the available story prose as a continuous reading experience.
- **Solve Along** reveals the story progressively and asks learners to complete decisions before continuing.

### Educational Concepts

Concepts can be classified as core or supporting terms. Learners can select highlighted terms to view:

- The lesson definition
- The meaning of the concept inside the story
- Alternative forms or aliases when available

### Key Terms Panel

The Story Reader provides a compact reference containing core concepts first, followed by supporting concepts.

### Decisions and Quizzes

Lorely includes interactive decision blocks and chapter-end questions. Each item can provide a hint and an explanation so the assessment becomes part of the learning process.

### Fair Answer Placement

Generated answer choices pass through a backend normalization step before the StoryArc is saved. This process:

- Preserves every answer choice
- Preserves the semantically correct answer
- Reorders choices safely
- Updates the correct answer index
- Balances correct-answer positions across the arc
- Runs only once so answers remain stable after refresh

### Multilingual Learning

Lorely supports generating story content and assessments in the selected language. English and Filipino are the primary supported languages. Academic and technical terms can remain in their familiar English form when translating them would reduce clarity.

### Reading Assistance

Lorely uses the browser Web Speech API for text-to-speech. The reader supports:

- Listen
- Pause and resume
- Stop
- Playback speeds of 0.75x, 1x, 1.25x, and 1.5x
- Optional key-term highlighting

## System Architecture

```text
Learner or Teacher
        |
        | HTTPS
        v
Vite Web Application
        |
        | JSON API
        v
FastAPI Backend
     /       \
    v         v
Gemini API   MongoDB
Generation   StoryArc persistence
```

The frontend manages lesson setup and the reading experience. The backend manages prompts, request models, structured-output validation, answer normalization, and persistence. AI and database credentials remain private on the backend.

## Technology Stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Frontend | Vite and web UI | Lesson setup, Story Reader, concept interactions, decisions, quizzes, and preferences |
| Backend | FastAPI | API routes, validation, AI orchestration, normalization, and health checks |
| AI | Google Gemini | Structured story, concept, decision, and quiz generation |
| Database | MongoDB | Persistent StoryArc and series data |
| Accessibility | Web Speech API | Browser-native text-to-speech |
| Deployment | Vercel | Independently deployed frontend and backend |

## Project Structure

The exact folder names may differ by repository, but Lorely follows this separation of responsibilities:

```text
lorely/
├── frontend/        # Vite application and Story Reader
├── backend/         # FastAPI application and generation services
├── tests/           # Frontend and backend tests
├── LORELY_SPEC.md   # Product and implementation specification
└── README.md
```

## Local Development

### Prerequisites

- Node.js and a compatible package manager
- Python supported by the backend project
- MongoDB database
- Google Gemini API key

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. Configure the Backend

Create the backend environment file using the example supplied by the repository.

```env
GEMINI_API_KEY=your_gemini_api_key
MONGODB_URI=your_mongodb_connection_string
FRONTEND_URL=http://localhost:<frontend-port>
```

Install the backend dependencies and start the FastAPI application using the commands defined by the repository's dependency and task files.

### 3. Configure the Frontend

Create the frontend environment file:

```env
VITE_API_BASE_URL=http://localhost:<backend-port>
```

Install the frontend dependencies and start the Vite development server using the package scripts included in the repository.

> Values prefixed with `VITE_` are exposed to the browser. Never place API keys, database credentials, or other secrets in frontend environment variables.

## Production Configuration

The deployed frontend needs the public backend URL:

```env
VITE_API_BASE_URL=https://your-backend-domain.example
```

The backend needs the deployed frontend origin for its cross-origin configuration:

```env
FRONTEND_URL=https://your-frontend-domain.example
```

Keep these values private on the backend:

- `GEMINI_API_KEY`
- `MONGODB_URI`
- Database passwords
- Private service tokens

Redeploy the affected application after changing production environment variables.

## Health Check

A healthy backend reports that the API is available, MongoDB is connected, and the AI service is configured. A typical response resembles:

```json
{
  "status": "ok",
  "database": "connected",
  "ai": "configured",
  "message": null
}
```

Use the health-check path defined by the backend application.

## Recommended Production Test

After deployment, verify the complete learner flow:

1. Open Lorely.
2. Load or enter a sample lesson.
3. Select story preferences and generate a story.
4. Open the Story Reader.
5. Select a highlighted concept.
6. Complete a Solve Along decision.
7. Complete a chapter quiz.
8. Refresh the page and confirm that persisted choices remain in the same order.
9. Test text-to-speech and the highlight toggle.
10. Generate a story in each supported language.

## Testing Priorities

Important regression coverage includes:

- Structured Gemini responses pass schema validation.
- Required lesson concepts remain present in the generated StoryArc.
- Decisions and quizzes preserve the correct semantic answer after normalization.
- Correct-answer positions vary across newly generated arcs.
- Saved answer ordering remains stable across repeated retrievals.
- Existing persisted arcs remain backward compatible.
- Solve Along progression does not reveal locked story content.
- Text-to-speech stops when the learner changes chapters or leaves the reader.
- Generated stories, decisions, hints, explanations, and quizzes use the selected language consistently.

## Design Principles

- Keep the reading experience editorial and focused.
- Use AI for structured generation, not unrestricted chat.
- Validate generated content before it reaches the learner.
- Preserve technical terminology when translation would reduce clarity.
- Store normalized story data once and keep it stable when reloaded.
- Prefer native browser accessibility features when they meet the need.
- Avoid unnecessary features that distract from the lesson and story loop.

## Current Scope

Lorely focuses on lesson-to-story generation, interactive reading, concept support, assessments, multilingual output, accessibility, and persistent StoryArcs.

The current scope does not require authentication, gamification, image generation, an AI chat assistant, or a paid text-to-speech provider.

## Contributing

1. Create a branch for the change.
2. Keep changes aligned with `LORELY_SPEC.md`.
3. Add or update tests for affected behavior.
4. Confirm existing story, decision, quiz, persistence, and accessibility flows still work.
5. Open a pull request that explains the user-facing change and its test coverage.

## License

Add the project's selected license here. If the repository already contains a license file, replace this section with a link to it.

## Acknowledgements

Lorely uses Google Gemini for structured educational story generation and the Web Speech API for browser-native reading assistance.
