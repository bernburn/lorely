"""Opt-in verification, never run by pytest.

mongo: deterministic AI fixtures with REAL MongoDB/API writes and rollback checks.
gemini: minimal REAL structured Gemini call through the normal AI service.
live: one REAL Quick generation; optional --continue-story creates Arc 2.
No secret, model output, or raw exception is printed. Existing .env is read-only.
"""
import argparse
import asyncio
import json
import logging
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
logging.disable(logging.CRITICAL)

from bson import ObjectId
from fastapi import HTTPException
import httpx
from pydantic import BaseModel

from app.config import get_settings
from app.database import lifespan
from app.main import app
from app.schemas.story import GeneratedArc, GeneratedNewStory, StoryPreferences
from app.services.ai_service import AIService, get_ai_service
from app.services.story_repository import StoryRepository


def report(**values):
    print(json.dumps(values), flush=True)


def sanitized_upstream_message(error):
    settings = get_settings()
    uri = settings.mongodb_uri.get_secret_value()
    parts = urlsplit(uri)
    secrets = [uri, settings.gemini_api_key.get_secret_value(), parts.username, parts.password]
    secrets += [unquote(value) for value in secrets if value]
    message = str(error)
    for value in sorted({value for value in secrets if value}, key=len, reverse=True):
        message = message.replace(value, "[REDACTED]")
    message = re.sub(r"mongodb(?:\+srv)?://[^\s'\"<>]+", "[REDACTED_URI]", message)
    message = re.sub(r"(?i)([?&]key=)[^&\s]+", r"\1[REDACTED]", message)
    return message[:3000]


def require_response(response, status):
    if response.status_code != status:
        # Known application errors have already been sanitized by the service layer.
        report(api_http_status=response.status_code, api_error=response.json().get("detail", "Request failed"))
        raise RuntimeError("API verification did not succeed")
    return response.json()


def continuation_pdf():
    from io import BytesIO
    from pypdf import PdfWriter
    from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
    text = (
        "Network Security: A firewall applies rules to allow or block network traffic. "
        "Authentication verifies who is requesting access. Authorization determines what an authenticated "
        "person is permitted to do. Use strong unique passwords and multifactor authentication when available. "
        "Keep software updated to fix known vulnerabilities. A firewall does not replace these practices."
    )
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
                             NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    stream = DecodedStreamObject()
    lines = [text[i:i + 75] for i in range(0, len(text), 75)]
    commands = "BT /F1 12 Tf 50 700 Td " + " ".join(f"({line}) Tj 0 -18 Td" for line in lines) + " ET"
    stream.set_data(commands.encode("ascii"))
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


async def minimal_gemini():
    class MinimalResponse(BaseModel):
        ok: bool

    ai = AIService()
    upstream = []

    async def observed_request(*args):
        try:
            return await ai._request(*args)
        except Exception as error:
            upstream.append({"exception_class": type(error).__module__ + "." + type(error).__name__,
                             "http_status": getattr(error, "status_code", getattr(error, "code", None))})
            raise

    try:
        # Thought tokens also consume max_output_tokens. The old 128-token cap
        # could truncate even a Boolean response. This opt-in probe sends once.
        async with asyncio.timeout(ai.settings.gemini_request_timeout_seconds):
            output = await observed_request("Set ok to true.", MinimalResponse, 512)
        result = MinimalResponse.model_validate_json(output)
        assert result.ok is True
        report(real_gemini="passed", structured_output=True, model=ai.settings.gemini_model)
    except Exception as error:
        report(real_gemini="blocked", exception_class=type(error).__module__ + "." + type(error).__name__,
               http_status=getattr(error, "status_code", getattr(error, "code", None)),
               clean_message="The single structured check failed; no story was generated.", upstream_attempts=upstream)
        return False
    return True


async def api_persistence(*, live: bool, lesson_id: str | None, continue_live: bool = False):
    if live:
        async def observed_live_request(prompt, schema, budget):
            try:
                return await AIService()._request(prompt, schema, budget)
            except Exception as error:
                report(upstream_exception=type(error).__module__ + "." + type(error).__name__,
                       upstream_http_status=getattr(error, "status_code", getattr(error, "code", None)),
                       sanitized_upstream_message=sanitized_upstream_message(error))
                raise
        app.dependency_overrides[get_ai_service] = lambda: AIService(transport=observed_live_request)
    else:
        sys.path.insert(0, str(BACKEND / "tests"))
        from story_fixtures import generated_story

        async def deterministic_output(prompt, schema, budget):
            return json.dumps(generated_story(solve='"interaction_mode": "Solve Along"' in prompt,
                                              continuation=schema is GeneratedArc))

        app.dependency_overrides[get_ai_service] = lambda: AIService(transport=deterministic_output)
    try:
        async with lifespan(app):
            database = app.state.database
            await database.client.admin.command("ping")
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://lorely-verification", timeout=150) as http:
                health = require_response(await http.get("/api/health"), 200)
                assert health["database"] == "connected"
                report(mode="REAL_GEMINI_AND_MONGODB" if live else "DETERMINISTIC_AI_FIXTURES_REAL_MONGODB", health=health, database=database.db.name)
                if lesson_id is None:
                    lesson_id = require_response(await http.post("/api/lessons/sample"), 201)["lesson_id"]
                preferences = StoryPreferences(genre="Mystery", interaction_mode="Solve Along", length="Quick",
                    core_plot="A group of students discovers an unknown device connected to their school's network.")
                created = require_response(await http.post("/api/stories/generate", json={"lesson_id": lesson_id, "preferences": preferences.model_dump()}), 201)
                repo = StoryRepository(database)
                arc = await repo.find_arc(created["arc_id"])
                series = await repo.find_series(created["series_id"])
                assert arc.lesson_id == lesson_id and arc.arc_number == 1 and series.arc_ids == [arc.arc_id]
                require_response(await http.get("/api/arcs/" + arc.arc_id), 200)
                public = require_response(await http.get("/api/series/" + series.series_id), 200)
                assert "story_bible" not in public
                decisions = sum(block.type == "decision" for chapter in arc.chapters for block in chapter.blocks)
                assert decisions >= 1
                report(arc1_persisted_and_retrieved=True, series_id=series.series_id, arc_id=arc.arc_id,
                       solve_along_verified=True, chapters=len(arc.chapters), decisions=decisions, bible_initialized=True)
                first_ids = list(series.arc_ids)
                if live and not continue_live:
                    return  # One Quick request by default; no extra quota use.
                new_lesson = require_response(await http.post("/api/lessons/upload", files={
                    "file": ("phase2-network-security-verification.pdf", continuation_pdf(), "application/pdf")}), 201)
                continued = require_response(await http.post(f"/api/series/{series.series_id}/continue", json={
                    "lesson_id": new_lesson["lesson_id"], "preferences": {"interaction_mode": "Just Read", "length": "Quick"},
                }), 201)
                second = await repo.find_arc(continued["arc_id"])
                updated = await repo.find_series(series.series_id)
                assert second.arc_number == 2 and second.series_id == arc.series_id
                assert second.lesson_id == new_lesson["lesson_id"] and updated.arc_ids == [*first_ids, second.arc_id]
                assert second.preferences.genre == arc.preferences.genre and second.preferences.storytelling_style == arc.preferences.storytelling_style
                assert all(block.type == "paragraph" for chapter in second.chapters for block in chapter.blocks)
                assert updated.story_bible.currentState == second.continuityUpdate.currentState
                assert updated.story_bible.overallPremise == series.story_bible.overallPremise
                assert {c.name.casefold() for c in series.story_bible.characters} <= {c.name.casefold() for c in updated.story_bible.characters}
                report(arc2_persisted_and_retrieved=True, arc_number=2, same_series=True, new_lesson_focus=True,
                       bible_updated=True, series_arc_ids_updated=True, continuation_just_read_verified=True,
                       arc_id=second.arc_id)
                if not live:
                    await verify_real_abort(database, arc, series)
                    # Stale concurrent continuation must not create another Arc 2.
                    from app.services.story_service import make_arc
                    from datetime import datetime, timezone
                    duplicate_id = str(ObjectId())
                    duplicate = make_arc(GeneratedArc.model_validate(generated_story(continuation=True)),
                        arc_id=duplicate_id, series_id=series.series_id, lesson_id=new_lesson["lesson_id"],
                        number=2, preferences=second.preferences, now=datetime.now(timezone.utc))
                    stale_series = series.model_copy(update={"arc_ids": [*first_ids, duplicate_id]})
                    try:
                        await repo.save(stale_series, duplicate, previous_arc_ids=first_ids)
                        raise RuntimeError("Stale continuation unexpectedly succeeded")
                    except HTTPException as error:
                        assert error.status_code == 409
                    assert await database.db.story_arcs.find_one({"_id": ObjectId(duplicate_id)}) is None
                    assert (await repo.find_series(series.series_id)).model_dump() == updated.model_dump()
                    report(real_stale_continuation_rejected=True, no_duplicate_arc=True)
    finally:
        app.dependency_overrides.clear()


async def verify_real_abort(database, arc, series):
    """Fault injection after a REAL MongoDB Arc insert proves transaction rollback."""
    from unittest.mock import patch
    from pymongo.asynchronous.collection import AsyncCollection
    from pymongo.errors import OperationFailure
    new_series_id, new_arc_id = str(ObjectId()), str(ObjectId())
    new_arc = arc.model_copy(update={"arc_id": new_arc_id, "series_id": new_series_id})
    new_series = series.model_copy(update={"series_id": new_series_id, "arc_ids": [new_arc_id]})
    original_insert = AsyncCollection.insert_one

    async def injected_failure(collection, *args, **kwargs):
        if collection.name == "story_series":
            raise OperationFailure("Controlled verification failure after Arc insert")
        return await original_insert(collection, *args, **kwargs)

    with patch.object(AsyncCollection, "insert_one", injected_failure):
        try:
            await StoryRepository(database).save(new_series, new_arc)
            raise RuntimeError("Controlled transaction unexpectedly succeeded")
        except HTTPException as error:
            assert error.status_code == 503
    assert await database.db.story_arcs.find_one({"_id": ObjectId(new_arc_id)}) is None
    assert await database.db.story_series.find_one({"_id": ObjectId(new_series_id)}) is None
    report(real_transaction_abort_verified=True, no_partial_arc_or_series=True)


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["mongo", "gemini", "live"])
    parser.add_argument("--lesson-id")
    parser.add_argument("--continue-story", action="store_true", help="Opt in to one live Quick Just Read continuation")
    args = parser.parse_args()
    original_env = (BACKEND / ".env").read_bytes()
    settings = get_settings()
    assert re.fullmatch(r"gemini-[A-Za-z0-9._-]+", settings.gemini_model)
    try:
        if args.mode == "gemini":
            success = await minimal_gemini()
        else:
            await api_persistence(live=args.mode == "live", lesson_id=args.lesson_id, continue_live=args.continue_story)
            success = True
    finally:
        assert (BACKEND / ".env").read_bytes() == original_env
        report(env_unchanged=True)
    return success


if __name__ == "__main__":
    try:
        sys.exit(0 if asyncio.run(main()) else 1)
    except Exception as error:
        report(verification_failed=True, exception_class=type(error).__name__)
        sys.exit(1)
