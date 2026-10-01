from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from app.database import Database
from app.prompts.story_continuation import continuation_prompt
from app.prompts.story_generation import generation_prompt
from app.schemas.series import StorySeries
from app.schemas.story import ContinueStoryRequest, GenerateStoryRequest, GeneratedArc, GeneratedNewStory, StoryArc, StoryCreated, StoryPreferences
from app.services.ai_service import AIService
from app.services.lesson_service import find_lesson
from app.services.series_service import initialize_bible, update_bible
from app.services.story_repository import StoryRepository

TOKEN_BUDGET = {"Quick": 8192, "Standard": 12288, "Long": 16384}


def make_arc(generated: GeneratedArc, *, arc_id: str, series_id: str, lesson_id: str,
             number: int, preferences: StoryPreferences, now: datetime) -> StoryArc:
    # New-Series-only fields are not persisted in an Arc.
    content = {field: getattr(generated, field) for field in GeneratedArc.model_fields}
    return StoryArc(**content, arc_id=arc_id, series_id=series_id, lesson_id=lesson_id,
                    arc_number=number, preferences=preferences, created_at=now)


async def generate_story(database: Database, ai: AIService, request: GenerateStoryRequest) -> StoryCreated:
    lesson = await find_lesson(database, request.lesson_id)
    preferences = request.preferences

    def validate(result: GeneratedNewStory):
        result.validate_interaction(preferences)
        initialize_bible(result.initialStoryBible, result.continuityUpdate)

    generated = await ai.generate(generation_prompt(lesson, preferences), GeneratedNewStory,
                                  validate=validate, max_output_tokens=TOKEN_BUDGET[preferences.length])
    now = datetime.now(timezone.utc)
    series_id, arc_id = str(ObjectId()), str(ObjectId())
    arc = make_arc(generated, arc_id=arc_id, series_id=series_id, lesson_id=request.lesson_id,
                   number=1, preferences=preferences, now=now)
    series = StorySeries(series_id=series_id, title=generated.seriesTitle,
                         genre=preferences.genre, storytelling_style=preferences.storytelling_style,
                         story_bible=initialize_bible(generated.initialStoryBible, generated.continuityUpdate),
                         arc_ids=[arc_id], created_at=now, updated_at=now)
    await StoryRepository(database).save(series, arc)
    return StoryCreated(series_id=series_id, arc_id=arc_id, arc_number=1)


async def continue_story(database: Database, ai: AIService, series_id: str,
                         request: ContinueStoryRequest) -> StoryCreated:
    repository = StoryRepository(database)
    series = await repository.find_series(series_id)
    previous = await repository.find_arc(series.arc_ids[-1])
    if previous.series_id != series.series_id or previous.arc_number != len(series.arc_ids):
        raise HTTPException(409, "This Series has inconsistent Arc history. Check the saved Series before continuing.")
    lesson = await find_lesson(database, request.lesson_id)
    if request.lesson_id == previous.lesson_id:
        raise HTTPException(400, "Choose a new Lesson to continue this story.")
    preferences = StoryPreferences.model_validate(previous.preferences.model_dump() | {
        "genre": series.genre, "storytelling_style": series.storytelling_style,
    } | request.preferences.model_dump(exclude_none=True))
    number = len(series.arc_ids) + 1

    def validate(result: GeneratedArc):
        result.validate_interaction(preferences)
        update_bible(series.story_bible, result.continuityUpdate)

    generated = await ai.generate(continuation_prompt(lesson, series, previous, preferences, number),
                                  GeneratedArc, validate=validate, max_output_tokens=TOKEN_BUDGET[preferences.length])
    now, arc_id = datetime.now(timezone.utc), str(ObjectId())
    arc = make_arc(generated, arc_id=arc_id, series_id=series.series_id, lesson_id=request.lesson_id,
                   number=number, preferences=preferences, now=now)
    updated = StorySeries.model_validate(series.model_dump() | {
        "story_bible": update_bible(series.story_bible, generated.continuityUpdate),
        "arc_ids": [*series.arc_ids, arc_id], "updated_at": now,
    })
    await repository.save(updated, arc, previous_arc_ids=series.arc_ids)
    return StoryCreated(series_id=series.series_id, arc_id=arc_id, arc_number=number)
