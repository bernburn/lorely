import json

from app.prompts.story_generation import INSTRUCTIONS, source_data
from app.schemas.lesson import LessonDetail
from app.schemas.series import StorySeries
from app.schemas.story import StoryArc, StoryPreferences


def continuation_prompt(lesson: LessonDetail, series: StorySeries, previous: StoryArc,
                        preferences: StoryPreferences, arc_number: int) -> str:
    return INSTRUCTIONS + f"""
Continue the established Series with Arc {arc_number}. Preserve Genre and Story Style.
The NEW lesson below is the sole educational source for this Arc. Story Bible is narrative
memory, NOT educational source material. Keep established characters, relationships, setting,
past events and unresolved threads coherent. Do not retell old Arcs. Give this Arc its own conflict,
educational focus, progression and climax, with room for subsequent Arcs.
Return only the Arc and continuityUpdate. New characters must have new names; existing characters
belong in characterUpdates. Do not contradict established facts. Keep updates compact.
NEW LESSON AND PREFERENCES DATA JSON:
""" + source_data(lesson, preferences) + "\nNARRATIVE MEMORY DATA JSON:\n" + json.dumps({
        "series_title": series.title,
        "story_bible": series.story_bible.model_dump(),
        "previous_arc_summary": previous.summary,
        "next_arc_number": arc_number,
    }, ensure_ascii=False)
