"""Deterministic UNIT and API CONTRACT tests; no Gemini or MongoDB network calls."""
import asyncio
import json
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from bson import ObjectId
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from pymongo.errors import OperationFailure, ServerSelectionTimeoutError

from app.config import Settings, get_settings
from app.database import get_database
from app.main import app
from app.prompts.story_continuation import continuation_prompt
from app.schemas.series import StoryBible
from app.schemas.story import ContinuationPreferences, GeneratedArc, GeneratedNewStory, StoryPreferences
from app.services.ai_service import AIService, BUSY, INVALID_OUTPUT, gemini_schema, get_ai_service, parse_result
from app.services.series_service import initialize_bible, update_bible
from app.services.story_repository import StoryRepository
from story_fixtures import UnitDatabase, generated_story


def run(awaitable):
    return asyncio.run(awaitable)


def unit_ai(transport):
    return AIService(Settings(_env_file=None, gemini_api_key="unit-key", gemini_model="unit-model"),
                     transport=transport, sleep=AsyncMock())


def test_defaults_and_controlled_preferences():
    assert StoryPreferences().model_dump() == {
        "genre": "Adventure", "storytelling_style": "Grounded", "interaction_mode": "Just Read", "tone": "Dramatic",
        "length": "Standard", "education_level": "Senior High", "complexity": "Balanced", "core_plot": "",
    }
    for field in ("genre", "storytelling_style", "interaction_mode", "tone", "length", "education_level", "complexity"):
        with pytest.raises(ValidationError):
            StoryPreferences(**{field: "invalid"})
    with pytest.raises(ValidationError):
        StoryPreferences(core_plot="x" * 501)
    assert len(StoryPreferences(core_plot="x" * 500).core_plot) == 500
    for field in ("genre", "storytelling_style"):
        with pytest.raises(ValidationError):
            ContinuationPreferences(**{field: "Mystery"})


@pytest.mark.parametrize("style", ["Allegory", "Grounded", "You Decide"])
@pytest.mark.parametrize("mode", ["Just Read", "Solve Along"])
def test_styles_and_interaction_are_independent(style, mode):
    preferences = StoryPreferences(storytelling_style=style, interaction_mode=mode)
    GeneratedNewStory.model_validate(generated_story(solve=mode == "Solve Along")).validate_interaction(preferences)


@pytest.mark.parametrize("mutation", [
    lambda d: d.update(chapters=[]),
    lambda d: d["chapters"][0].update(endQuiz=[]),
    lambda d: d["chapters"][0]["endQuiz"][0].update(correctIndex=2),
    lambda d: d["chapters"][0]["endQuiz"][0].update(correctIndex=-1),
    lambda d: d["chapters"][0]["endQuiz"][0].update(correctIndex=True),
    lambda d: d["chapters"][0]["endQuiz"][0].update(relatedConceptIds=["unknown"]),
    lambda d: d["chapters"][0].update(chapterNumber=2),
    lambda d: d["concepts"].append(deepcopy(d["concepts"][0])),
    lambda d: d["chapters"][0]["blocks"][0].update(text=" "),
    lambda d: d["chapters"][0]["endQuiz"][0].update(choices=["same", "same"]),
    lambda d: d["continuityUpdate"].update(resolvedThreads=["thread"], unresolvedThreads=["thread"]),
], ids=["no-chapters", "no-quiz", "answer-overflow", "negative-answer", "boolean-answer", "unknown-concept",
        "chapter-sequence", "duplicate-concept", "empty-narrative", "duplicate-choices", "contradictory-thread"])
def test_reject_invalid_generated_content(mutation):
    data = generated_story()
    mutation(data)
    with pytest.raises(ValidationError):
        GeneratedNewStory.model_validate(data)


def test_just_read_rejects_decisions():
    generated = GeneratedNewStory.model_validate(generated_story(solve=True))
    with pytest.raises(ValueError, match="Just Read"):
        generated.validate_interaction(StoryPreferences())


def test_bible_initialize_and_update_preserve_memory():
    initial = GeneratedNewStory.model_validate(generated_story())
    bible = initialize_bible(initial.initialStoryBible, initial.continuityUpdate)
    assert len(bible.characters) == 1  # Initial result and update do not duplicate names.
    assert "Who owns the device?" in bible.unresolvedThreads
    continuation = GeneratedArc.model_validate(generated_story(continuation=True))
    updated = update_bible(bible, continuation.continuityUpdate)
    assert bible.unresolvedThreads == ["Who owns the device?"]  # Original snapshot is immutable.
    assert updated.overallPremise == bible.overallPremise and updated.setting == bible.setting
    assert updated.characters[0].traits == ["analytical", "persistent"]
    assert updated.characters[0].importantHistory == ["Found an unknown device", "Protected the school's network"]
    assert updated.unresolvedThreads == ["Where did the second signal originate?"]
    assert updated.currentState == "The network is secure"
    assert len(updated.importantEvents) == 1  # Repeated facts are deduplicated.
    invalid = continuation.continuityUpdate.model_copy(deep=True)
    invalid.characterUpdates[0].name = "Unknown"
    with pytest.raises(ValueError, match="known"):
        update_bible(bible, invalid)
    invalid = continuation.continuityUpdate.model_copy(deep=True)
    invalid.resolvedThreads = ["Never established"]
    with pytest.raises(ValueError, match="established"):
        update_bible(bible, invalid)
    with pytest.raises(ValueError, match="overwrite"):
        update_bible(bible, initial.continuityUpdate)
    with pytest.raises(ValidationError):
        StoryBible.model_validate(bible.model_dump() | {"characters": [*bible.characters, *bible.characters]})


class UpstreamError(Exception):
    def __init__(self, code):
        self.status_code = code
        super().__init__("RAW secret SDK request")


@pytest.mark.parametrize("error", [UpstreamError(code) for code in (429, 500, 502, 503, 504)] +
                         [TimeoutError("secret"), httpx.ReadTimeout("secret")])
def test_transient_errors_retry_exactly_three_times(error):
    transport = AsyncMock(side_effect=error)
    ai = unit_ai(transport)
    with pytest.raises(HTTPException) as caught:
        run(ai.generate("unit prompt", GeneratedNewStory))
    assert transport.await_count == 3 and ai.sleep.await_count == 2
    assert caught.value.status_code == 503 and caught.value.detail == BUSY
    assert 1 <= ai.sleep.call_args_list[0].args[0] <= 1.25
    assert 2 <= ai.sleep.call_args_list[1].args[0] <= 2.25


@pytest.mark.parametrize("code", [400, 401, 403, 404, 422])
def test_permanent_errors_are_clean_and_not_retried(code):
    transport = AsyncMock(side_effect=UpstreamError(code))
    ai = unit_ai(transport)
    with pytest.raises(HTTPException) as caught:
        run(ai.generate("unit", GeneratedNewStory))
    assert transport.await_count == 1 and ai.sleep.await_count == 0
    assert caught.value.status_code == 502 and "RAW" not in caught.value.detail and "secret" not in caught.value.detail


def test_transient_recovery_and_one_validation_repair_share_call_budget():
    valid = json.dumps(generated_story())
    transport = AsyncMock(side_effect=[UpstreamError(503), "malformed private output", valid])
    ai = unit_ai(transport)
    result = run(ai.generate("unit", GeneratedNewStory))
    assert result.title == "The Unknown Device" and transport.await_count == 3
    assert "REPAIR" in transport.call_args_list[-1].args[0]
    assert "private output" not in transport.call_args_list[-1].args[0]
    transport = AsyncMock(return_value="malformed private output")
    with pytest.raises(HTTPException) as caught:
        run(unit_ai(transport).generate("unit", GeneratedNewStory))
    assert transport.await_count == 2 and caught.value.detail == INVALID_OUTPUT


def test_business_validation_is_repaired_once_and_never_silently_stripped():
    transport = AsyncMock(return_value=json.dumps(generated_story(solve=True)))
    with pytest.raises(HTTPException) as caught:
        run(unit_ai(transport).generate("unit", GeneratedNewStory,
                                       validate=lambda r: r.validate_interaction(StoryPreferences())))
    assert transport.await_count == 2 and caught.value.detail == INVALID_OUTPUT


def test_missing_ai_key_does_not_call_transport(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "")
    transport = AsyncMock()
    ai = AIService(Settings(_env_file=None, gemini_api_key=""), transport=transport)
    with pytest.raises(HTTPException, match="GEMINI_API_KEY"):
        run(ai.generate("unit", GeneratedNewStory))
    transport.assert_not_called()


def test_official_sdk_request_contract_and_disabled_internal_retries(monkeypatch):
    from google.genai._gaos.google_genai import _translate_retry_config
    from app.services import ai_service

    captured = {}
    create = AsyncMock(return_value=SimpleNamespace(output_text=json.dumps(generated_story())))

    class AsyncClient:
        interactions = SimpleNamespace(create=create)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            captured["closed"] = True

    def client(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(aio=AsyncClient())

    monkeypatch.setattr(ai_service.genai, "Client", client)
    ai = unit_ai(None)
    run(ai.generate("unit prompt", GeneratedNewStory))
    assert captured["vertexai"] is False and captured["closed"]
    assert _translate_retry_config(captured["http_options"]).max_retries == 0
    request = create.call_args.kwargs
    assert request["model"] == "unit-model" and request["store"] is False
    assert request["response_format"]["schema"] == gemini_schema(GeneratedNewStory)


def test_gemini_schema_preserves_typed_structure_and_backend_validation():
    schema = gemini_schema(GeneratedNewStory)
    definitions = schema["$defs"]
    block = definitions["GeminiBlock"]
    assert block["properties"]["type"]["enum"] == ["paragraph", "decision"]
    assert block["properties"]["text"]["type"] == ["string", "null"]
    assert block["required"] == list(block["properties"])
    assert schema["required"] == GeneratedNewStory.model_json_schema()["required"]
    assert definitions["GeminiChapter"]["properties"]["endQuiz"]["minItems"] == 1
    assert definitions["QuizQuestion"]["properties"]["correctIndex"]["minimum"] == 0
    # Schema projection never changes the strict model used to accept/persist output.
    bad = generated_story()
    bad["chapters"][0]["blocks"][0]["text"] = " "
    with pytest.raises(ValidationError):
        GeneratedNewStory.model_validate(bad)


def test_flat_gemini_blocks_convert_without_discarding_invalid_content():
    data = generated_story(solve=True)
    for chapter in data["chapters"]:
        for block in chapter["blocks"]:
            for field in ("text", "prompt", "choices", "correctIndex", "hint", "explanation", "relatedConceptIds"):
                block.setdefault(field, None)
    parsed = parse_result(GeneratedNewStory, json.dumps(data))
    assert parsed.chapters[0].blocks[1].type == "decision"
    assert parsed.chapters[0].blocks[0].model_dump() == {"type": "paragraph", "text": "Mira followed the packet through the router."}
    data["chapters"][0]["blocks"][0]["prompt"] = "A hidden Decision in a paragraph"
    with pytest.raises(ValidationError):
        parse_result(GeneratedNewStory, json.dumps(data))
    data["chapters"][0]["blocks"][0]["prompt"] = None
    data["chapters"][0]["blocks"][1]["hint"] = None
    with pytest.raises(ValidationError):
        parse_result(GeneratedNewStory, json.dumps(data))


@pytest.fixture
def contract_client(monkeypatch):
    monkeypatch.setenv("MONGODB_URI", "")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    get_settings.cache_clear()
    database = UnitDatabase()

    async def transport(prompt, schema, budget):
        return json.dumps(generated_story(solve='"interaction_mode": "Solve Along"' in prompt,
                                          continuation=schema is GeneratedArc))

    ai = unit_ai(transport)
    with TestClient(app) as client:
        app.dependency_overrides[get_database] = lambda: database
        app.dependency_overrides[get_ai_service] = lambda: ai
        yield client, database
    app.dependency_overrides.clear()
    get_settings.cache_clear()


def create_contract_story(client, mode="Just Read"):
    lesson = client.post("/api/lessons/sample").json()
    response = client.post("/api/stories/generate", json={"lesson_id": lesson["lesson_id"],
                           "preferences": {"genre": "Mystery", "interaction_mode": mode, "length": "Quick"}})
    assert response.status_code == 201, response.text
    return response.json(), lesson


@pytest.mark.parametrize("mode", ["Just Read", "Solve Along"])
def test_new_story_and_retrieval_contract(contract_client, mode):
    client, database = contract_client
    created, lesson = create_contract_story(client, mode)
    arc = client.get(f"/api/arcs/{created['arc_id']}")
    series = client.get(f"/api/series/{created['series_id']}")
    assert arc.status_code == series.status_code == 200
    assert arc.json()["lesson_id"] == lesson["lesson_id"] and arc.json()["arc_number"] == 1
    assert series.json()["arc_ids"] == [created["arc_id"]] and "story_bible" not in series.json()
    assert database.commits == 1 and len(database.documents["story_arcs"]) == len(database.documents["story_series"]) == 1
    assert "continuity_update" in next(iter(database.documents["story_arcs"].values()))
    assert database.indexes[-1][1]["unique"] is True


def test_continuation_contract_and_prompt_memory(contract_client):
    client, database = contract_client
    created, old_lesson = create_contract_story(client, "Solve Along")
    new_lesson = client.post("/api/lessons/sample").json()
    response = client.post(f"/api/series/{created['series_id']}/continue", json={
        "lesson_id": new_lesson["lesson_id"], "preferences": {"interaction_mode": "Just Read", "core_plot": "The second signal"},
    })
    assert response.status_code == 201, response.text
    continued = response.json()
    assert continued["series_id"] == created["series_id"] and continued["arc_number"] == 2
    arc = client.get(f"/api/arcs/{continued['arc_id']}").json()
    assert arc["lesson_id"] == new_lesson["lesson_id"]
    assert arc["preferences"]["genre"] == "Mystery" and arc["preferences"]["storytelling_style"] == "Grounded"
    assert arc["preferences"]["length"] == "Quick"  # Inherited from previous Arc.
    assert all(block["type"] == "paragraph" for chapter in arc["chapters"] for block in chapter["blocks"])
    saved = database.documents["story_series"][ObjectId(created["series_id"])]
    assert saved["arc_ids"] == [created["arc_id"], continued["arc_id"]]
    assert saved["story_bible"]["currentState"] == "The network is secure" and database.commits == 2
    assert saved["story_bible"]["unresolvedThreads"] == ["Where did the second signal originate?"]

    async def inspect_prompt():
        from app.services.lesson_service import find_lesson
        repo = StoryRepository(database)
        series = await repo.find_series(created["series_id"])
        previous = await repo.find_arc(continued["arc_id"])
        lesson = await find_lesson(database, new_lesson["lesson_id"])
        prompt = continuation_prompt(lesson, series, previous, previous.preferences, 3)
        assert "previous_arc_summary" in prompt and "story_bible" in prompt and "NEW lesson" in prompt
        assert "Mira followed the packet through the router." not in prompt  # No old chapter text.
        assert lesson.extracted_text in json.loads(prompt.split("DATA JSON:\n", 1)[1].split("\nNARRATIVE MEMORY")[0])["lesson_text"]
    run(inspect_prompt())


def test_invalid_ids_missing_documents_and_no_list_endpoint(contract_client):
    client, database = contract_client
    for path in ("/api/arcs", "/api/series"):
        assert client.get(path).status_code == 404
        assert client.get(path + "/invalid").status_code == 400
        assert client.get(path + f"/{ObjectId()}").status_code == 404
    assert client.post("/api/stories/generate", json={"lesson_id": "invalid"}).status_code == 422
    assert client.post("/api/stories/generate", json={"lesson_id": str(ObjectId())}).status_code == 404
    assert client.post("/api/series/invalid/continue", json={"lesson_id": str(ObjectId())}).status_code == 400
    created, lesson = create_contract_story(client)
    assert client.post(f"/api/series/{created['series_id']}/continue", json={"lesson_id": lesson["lesson_id"]}).status_code == 400
    assert client.post(f"/api/series/{created['series_id']}/continue", json={"lesson_id": str(ObjectId()),
                       "preferences": {"genre": "Fantasy"}}).status_code == 422


def test_initial_persistence_failure_aborts_contract(contract_client):
    client, database = contract_client
    lesson = client.post("/api/lessons/sample").json()
    database.db.story_series.fail_insert = OperationFailure("RAW secret database failure")
    response = client.post("/api/stories/generate", json={"lesson_id": lesson["lesson_id"]})
    assert response.status_code == 503 and "RAW" not in response.text
    assert not database.documents["story_arcs"] and not database.documents["story_series"]
    assert database.aborts == 1 and database.commits == 0


@pytest.mark.parametrize("conflict", [False, True])
def test_continuation_failure_preserves_bible_and_arc_ids(contract_client, conflict):
    client, database = contract_client
    created, lesson = create_contract_story(client)
    new_lesson = client.post("/api/lessons/sample").json()
    saved = deepcopy(database.documents)
    if conflict:
        database.db.story_series.force_conflict = True
    else:
        database.db.story_arcs.fail_insert = ServerSelectionTimeoutError("RAW secret")
    response = client.post(f"/api/series/{created['series_id']}/continue", json={"lesson_id": new_lesson["lesson_id"]})
    assert response.status_code == (409 if conflict else 503)
    assert "RAW" not in response.text and database.documents == saved
    assert database.aborts == 1


def test_clean_generation_error_api_does_not_persist(contract_client):
    client, database = contract_client
    lesson = client.post("/api/lessons/sample").json()
    app.dependency_overrides[get_ai_service] = lambda: unit_ai(AsyncMock(side_effect=UpstreamError(503)))
    response = client.post("/api/stories/generate", json={"lesson_id": lesson["lesson_id"]})
    assert response.status_code == 503 and response.json()["detail"] == BUSY
    assert not database.documents["story_series"] and not database.documents["story_arcs"]


def test_repository_rejects_incoherent_arc_number_before_writes(contract_client):
    client, database = contract_client
    created, lesson = create_contract_story(client)

    async def check():
        repository = StoryRepository(database)
        arc = await repository.find_arc(created["arc_id"])
        series = await repository.find_series(created["series_id"])
        before = deepcopy(database.documents)
        for invalid_arc in (arc.model_copy(update={"arc_number": 2}),
                            arc.model_copy(update={"series_id": str(ObjectId())})):
            with pytest.raises(ValueError, match="numbering/IDs"):
                await repository.save(series, invalid_arc)
        assert database.documents == before and database.commits == 1
    run(check())


def test_unknown_character_business_error_repairs_and_never_persists(contract_client):
    client, database = contract_client
    created, lesson = create_contract_story(client)
    new_lesson = client.post("/api/lessons/sample").json()
    invalid = generated_story(continuation=True)
    invalid["continuityUpdate"]["characterUpdates"][0]["name"] = "Unknown character"
    transport = AsyncMock(return_value=json.dumps(invalid))
    app.dependency_overrides[get_ai_service] = lambda: unit_ai(transport)
    before = deepcopy(database.documents)
    response = client.post(f"/api/series/{created['series_id']}/continue", json={"lesson_id": new_lesson["lesson_id"]})
    assert response.status_code == 502 and response.json()["detail"] == INVALID_OUTPUT
    assert transport.await_count == 2 and database.documents == before
