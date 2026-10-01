"""PyMongo Async persistence. AI calls always occur outside transactions."""
from bson import ObjectId
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError, PyMongoError
from pymongo.read_concern import ReadConcern
from pymongo.write_concern import WriteConcern

from app.database import Database, UNAVAILABLE
from app.schemas.series import StorySeries
from app.schemas.story import StoryArc

SAVE_ERROR = "The story was not confirmed saved. Please check the database and try again."
CONFLICT = "This Series was continued by another request. Reload the Series before trying again."


def object_id(value: str, label: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(400, f"This {label} ID is invalid.")
    return ObjectId(value)


def arc_document(arc: StoryArc) -> dict:
    document = arc.model_dump()
    document["_id"] = ObjectId(document.pop("arc_id"))
    document["continuity_update"] = document.pop("continuityUpdate")
    return document


def series_document(series: StorySeries) -> dict:
    document = series.model_dump()
    document["_id"] = ObjectId(document.pop("series_id"))
    return document


class StoryRepository:
    def __init__(self, database: Database):
        self.database = database

    async def find_arc(self, arc_id: str) -> StoryArc:
        key = object_id(arc_id, "Arc")
        try:
            document = await self.database.require().story_arcs.find_one({"_id": key})
        except PyMongoError:
            raise HTTPException(503, UNAVAILABLE) from None
        if document is None:
            raise HTTPException(404, "This Story Arc could not be found.")
        document = dict(document)
        document["arc_id"] = str(document.pop("_id"))
        document["continuityUpdate"] = document.pop("continuity_update")
        return StoryArc.model_validate(document)

    async def find_series(self, series_id: str) -> StorySeries:
        key = object_id(series_id, "Series")
        try:
            document = await self.database.require().story_series.find_one({"_id": key})
        except PyMongoError:
            raise HTTPException(503, UNAVAILABLE) from None
        if document is None:
            raise HTTPException(404, "This Story Series could not be found.")
        document = dict(document)
        document["series_id"] = str(document.pop("_id"))
        return StorySeries.model_validate(document)

    async def save(self, series: StorySeries, arc: StoryArc, *, previous_arc_ids: list[str] | None = None):
        db = self.database.require()
        if arc.series_id != series.series_id or series.arc_ids[-1] != arc.arc_id or arc.arc_number != len(series.arc_ids):
            raise ValueError("Arc and Series numbering/IDs must agree")
        if previous_arc_ids is None and arc.arc_number != 1:
            raise ValueError("A new Series must start at Arc 1")
        if previous_arc_ids is not None and series.arc_ids != [*previous_arc_ids, arc.arc_id]:
            raise ValueError("Continuation must append exactly one Arc")

        async def persist(session):
            # The Series is updated only after the Arc insert succeeds; both commit together.
            await db.story_arcs.insert_one(arc_document(arc), session=session)
            if previous_arc_ids is None:
                await db.story_series.insert_one(series_document(series), session=session)
            else:
                result = await db.story_series.update_one(
                    {"_id": ObjectId(series.series_id), "arc_ids": previous_arc_ids},
                    {"$set": {"story_bible": series.story_bible.model_dump(),
                              "arc_ids": series.arc_ids, "updated_at": series.updated_at}},
                    session=session,
                )
                if result.matched_count != 1:
                    raise HTTPException(409, CONFLICT)

        try:
            await db.story_arcs.create_index([("series_id", 1), ("arc_number", 1)], unique=True)
            async with self.database.client.start_session() as session:
                await session.with_transaction(persist, read_concern=ReadConcern("snapshot"),
                                               write_concern=WriteConcern("majority"), max_commit_time_ms=10000)
        except DuplicateKeyError:
            raise HTTPException(409, CONFLICT) from None
        except PyMongoError:
            # Includes unsupported transactions: never fall back to partial writes.
            raise HTTPException(503, SAVE_ERROR) from None
