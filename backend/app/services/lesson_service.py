from bson import ObjectId
from fastapi import HTTPException
from pymongo.errors import PyMongoError

from app.database import Database, UNAVAILABLE
from app.schemas.lesson import Lesson, LessonDetail, LessonMetadata


async def save_lesson(database: Database, lesson: Lesson) -> LessonMetadata:
    db = database.require()
    try:
        result = await db.lessons.insert_one(lesson.model_dump())
    except PyMongoError:
        raise HTTPException(503, UNAVAILABLE + " The lesson was not confirmed saved; retry when the database is available.") from None
    return LessonMetadata(lesson_id=str(result.inserted_id), **lesson.model_dump())


async def find_lesson(database: Database, lesson_id: str) -> LessonDetail:
    if not ObjectId.is_valid(lesson_id):
        raise HTTPException(400, "This lesson ID is invalid.")
    db = database.require()
    try:
        document = await db.lessons.find_one({"_id": ObjectId(lesson_id)})
    except PyMongoError:
        raise HTTPException(503, UNAVAILABLE) from None
    if document is None:
        raise HTTPException(404, "This lesson could not be found.")
    return LessonDetail(lesson_id=str(document.pop("_id")), **document)
