"""Compact narrative memory. This is never the educational source."""
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

MemoryText = Annotated[str, Field(min_length=1, max_length=1500)]
MemoryList = Annotated[list[MemoryText], Field(max_length=50)]


class MemoryContract(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class StoryCharacter(MemoryContract):
    name: str = Field(min_length=1, max_length=100)
    role: MemoryText
    traits: MemoryList
    relationships: MemoryList
    importantHistory: MemoryList


class CharacterUpdate(MemoryContract):
    name: str = Field(min_length=1, max_length=100)
    traits: MemoryList
    relationships: MemoryList
    importantHistory: MemoryList


class StoryBible(MemoryContract):
    overallPremise: MemoryText
    setting: MemoryText
    characters: list[StoryCharacter] = Field(max_length=30)
    relationships: MemoryList
    importantEvents: MemoryList
    establishedStoryFacts: MemoryList
    unresolvedThreads: MemoryList
    currentState: MemoryText
    toneNotes: MemoryText

    @model_validator(mode="after")
    def unique_characters(self):
        if len({c.name.casefold() for c in self.characters}) != len(self.characters):
            raise ValueError("Character names must be unique")
        return self


class ContinuityUpdate(MemoryContract):
    arcSummary: MemoryText
    newCharacters: list[StoryCharacter] = Field(max_length=12)
    characterUpdates: list[CharacterUpdate] = Field(max_length=30)
    importantEvents: MemoryList
    newEstablishedFacts: MemoryList
    resolvedThreads: MemoryList
    unresolvedThreads: MemoryList
    currentState: MemoryText
    relationshipUpdates: MemoryList
    toneNotes: str = Field(max_length=1500)

    @model_validator(mode="after")
    def coherent_updates(self):
        for group in (self.newCharacters, self.characterUpdates):
            if len({c.name.casefold() for c in group}) != len(group):
                raise ValueError("Continuity character names must be unique")
        if {t.casefold() for t in self.resolvedThreads} & {t.casefold() for t in self.unresolvedThreads}:
            raise ValueError("A thread cannot be both resolved and unresolved")
        return self


class StorySeries(MemoryContract):
    series_id: str
    title: str = Field(min_length=1, max_length=2000)
    genre: Literal["Fantasy", "Mystery", "Sci-Fi", "Adventure", "Horror"]
    storytelling_style: Literal["Allegory", "Grounded", "You Decide"]
    story_bible: StoryBible
    arc_ids: list[str] = Field(min_length=1)
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def valid_ids(self):
        from bson import ObjectId
        if not all(ObjectId.is_valid(value) for value in [self.series_id, *self.arc_ids]):
            raise ValueError("Series and Arc IDs must be valid")
        if len(set(self.arc_ids)) != len(self.arc_ids):
            raise ValueError("Series Arc IDs must be unique")
        return self


class SeriesDetail(MemoryContract):
    """Public metadata: keep the internal Story Bible out of the reader API."""
    series_id: str
    title: str
    genre: str
    storytelling_style: str
    arc_ids: list[str]
    created_at: datetime
    updated_at: datetime
