from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.limits import MAX_PAGES, MAX_EXTRACTED_CHARACTERS

class LessonPage(BaseModel):
    page_number: int = Field(ge=1)
    text: str


class Lesson(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=255)
    source: Literal["pdf", "sample"]
    file_size_bytes: int | None = Field(default=None, ge=0)
    page_count: int = Field(ge=1, le=MAX_PAGES)
    character_count: int = Field(ge=1, le=MAX_EXTRACTED_CHARACTERS)
    pages: list[LessonPage]
    extracted_text: str = Field(min_length=1, max_length=MAX_EXTRACTED_CHARACTERS)
    status: Literal["ready"] = "ready"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def validate_extraction(self):
        if self.page_count != len(self.pages):
            raise ValueError("Page count must match pages")
        if [page.page_number for page in self.pages] != list(range(1, self.page_count + 1)):
            raise ValueError("Pages must be ordered and numbered from one")
        if self.extracted_text != "\n\n".join(page.text for page in self.pages):
            raise ValueError("Combined text must match page text")
        if self.character_count != len(self.extracted_text):
            raise ValueError("Character count must match extracted text")
        return self


class LessonMetadata(BaseModel):
    lesson_id: str
    filename: str
    title: str
    source: Literal["pdf", "sample"]
    file_size_bytes: int | None
    page_count: int
    character_count: int
    status: Literal["ready"]
    created_at: datetime


class LessonDetail(Lesson):
    lesson_id: str
