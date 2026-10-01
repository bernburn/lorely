"""Structured Gemini output and public story contracts."""
from datetime import datetime
from typing import Annotated, Literal

from bson import ObjectId
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

Text = Annotated[str, Field(min_length=1, max_length=2000)]
Genre = Literal["Fantasy", "Mystery", "Sci-Fi", "Adventure", "Horror"]
StoryStyle = Literal["Allegory", "Grounded", "You Decide"]
InteractionMode = Literal["Just Read", "Solve Along"]
Tone = Literal["Lighthearted", "Serious", "Funny", "Dramatic"]
Length = Literal["Quick", "Standard", "Long"]
EducationLevel = Literal["Elementary", "Junior High", "Senior High", "College"]
Complexity = Literal["Easy to Read", "Balanced", "Advanced"]


def valid_id(value: str) -> str:
    if not ObjectId.is_valid(value):
        raise ValueError("Must be a valid MongoDB ID")
    return str(ObjectId(value))


MongoId = Annotated[str, AfterValidator(valid_id)]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class StoryPreferences(Contract):
    genre: Genre = "Adventure"
    storytelling_style: StoryStyle = "Grounded"
    interaction_mode: InteractionMode = "Just Read"
    tone: Tone = "Dramatic"
    length: Length = "Standard"
    education_level: EducationLevel = "Senior High"
    complexity: Complexity = "Balanced"
    core_plot: str = Field(default="", max_length=500)


class ContinuationPreferences(Contract):
    # Omitted values inherit from the last Arc; genre/style cannot be supplied.
    interaction_mode: InteractionMode | None = None
    tone: Tone | None = None
    length: Length | None = None
    education_level: EducationLevel | None = None
    complexity: Complexity | None = None
    core_plot: str | None = Field(default=None, max_length=500)


class GenerateStoryRequest(Contract):
    lesson_id: MongoId
    preferences: StoryPreferences = Field(default_factory=StoryPreferences)


class ContinueStoryRequest(Contract):
    lesson_id: MongoId
    preferences: ContinuationPreferences = Field(default_factory=ContinuationPreferences)


class EducationalConcept(Contract):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9_-]+$")
    term: Text
    definition: Text
    storyContext: Text


class AnswerChoices(Contract):
    choices: list[Text] = Field(min_length=2, max_length=6)
    correctIndex: int = Field(ge=0, strict=True)
    hint: Text
    explanation: Text
    relatedConceptIds: list[str] = Field(min_length=1, max_length=12)

    @model_validator(mode="after")
    def valid_answer(self):
        if self.correctIndex >= len(self.choices):
            raise ValueError("correctIndex must reference a choice")
        if len({choice.casefold() for choice in self.choices}) != len(self.choices):
            raise ValueError("Choices must be distinct")
        return self


class ParagraphBlock(Contract):
    type: Literal["paragraph"]
    text: str = Field(min_length=1, max_length=8000)


class DecisionBlock(AnswerChoices):
    type: Literal["decision"]
    prompt: Text


StoryBlock = Annotated[ParagraphBlock | DecisionBlock, Field(discriminator="type")]


class QuizQuestion(AnswerChoices):
    question: Text


class StoryChapter(Contract):
    chapterNumber: int = Field(ge=1, strict=True)
    title: Text
    blocks: list[StoryBlock] = Field(min_length=1, max_length=40)
    endQuiz: list[QuizQuestion] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def has_narrative(self):
        if not any(isinstance(block, ParagraphBlock) for block in self.blocks):
            raise ValueError("A chapter must contain narrative paragraphs")
        return self


class GeneratedArc(Contract):
    title: Text
    summary: Text
    concepts: list[EducationalConcept] = Field(min_length=1, max_length=40)
    chapters: list[StoryChapter] = Field(min_length=1, max_length=6)
    continuityUpdate: "ContinuityUpdate"

    @model_validator(mode="after")
    def coherent_content(self):
        ids = {concept.id for concept in self.concepts}
        if len(ids) != len(self.concepts):
            raise ValueError("Concept IDs must be unique")
        if [chapter.chapterNumber for chapter in self.chapters] != list(range(1, len(self.chapters) + 1)):
            raise ValueError("Chapters must be ordered and numbered from one")
        for chapter in self.chapters:
            questions = chapter.endQuiz + [block for block in chapter.blocks if isinstance(block, DecisionBlock)]
            if any(not set(question.relatedConceptIds) <= ids for question in questions):
                raise ValueError("Questions must reference this Arc's concepts")
        return self

    def validate_interaction(self, preferences: StoryPreferences):
        if preferences.interaction_mode == "Just Read" and any(
            isinstance(block, DecisionBlock) for chapter in self.chapters for block in chapter.blocks
        ):
            raise ValueError("Just Read must not contain Decision blocks")
        return self


# Imported here to keep the Story Bible models independently reusable.
from app.schemas.series import ContinuityUpdate, StoryBible  # noqa: E402

GeneratedArc.model_rebuild()


class GeneratedNewStory(GeneratedArc):
    seriesTitle: Text
    initialStoryBible: StoryBible


class GeminiBlock(Contract):
    """Flat tagged wire shape avoids deeply nested object unions in Gemini.

    Unused fields must be null. Conversion rejects conflicting content and then
    validates the same strict ParagraphBlock/DecisionBlock public contracts.
    """
    type: Literal["paragraph", "decision"]
    text: str | None = Field(default=None, min_length=1, max_length=8000)
    prompt: Text | None = None
    choices: list[Text] | None = Field(default=None, min_length=2, max_length=6)
    correctIndex: Annotated[int, Field(ge=0, strict=True)] | None = None
    hint: Text | None = None
    explanation: Text | None = None
    relatedConceptIds: list[str] | None = Field(default=None, min_length=1, max_length=12)

    def native(self) -> dict:
        data = self.model_dump(exclude_none=True)
        # Native extra='forbid' ensures non-null fields from the other variant
        # cannot be discarded or accepted as part of a paragraph.
        model = ParagraphBlock if self.type == "paragraph" else DecisionBlock
        return model.model_validate(data).model_dump()


class GeminiChapter(Contract):
    chapterNumber: int = Field(ge=1, strict=True)
    title: Text
    blocks: list[GeminiBlock] = Field(min_length=1, max_length=40)
    endQuiz: list[QuizQuestion] = Field(min_length=1, max_length=4)


class GeminiArc(Contract):
    title: Text
    summary: Text
    concepts: list[EducationalConcept] = Field(min_length=1, max_length=40)
    chapters: list[GeminiChapter] = Field(min_length=1, max_length=6)
    continuityUpdate: ContinuityUpdate

    def native(self) -> dict:
        data = self.model_dump()
        for native_chapter, chapter in zip(data["chapters"], self.chapters):
            native_chapter["blocks"] = [block.native() for block in chapter.blocks]
        return data


class GeminiNewStory(GeminiArc):
    seriesTitle: Text
    initialStoryBible: StoryBible


class StoryArc(GeneratedArc):
    arc_id: MongoId
    series_id: MongoId
    lesson_id: MongoId
    arc_number: int = Field(ge=1, strict=True)
    preferences: StoryPreferences
    created_at: datetime

    @model_validator(mode="after")
    def valid_mode(self):
        return self.validate_interaction(self.preferences)


class StoryCreated(Contract):
    series_id: MongoId
    arc_id: MongoId
    arc_number: int = Field(ge=1)
