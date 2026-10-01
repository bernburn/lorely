from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from pydantic import ValidationError
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
from pymongo.errors import ServerSelectionTimeoutError

from app.config import Settings, get_settings
from app.data.sample_lesson import create_sample_lesson
from app.database import get_database
from app.main import app
from app.services import pdf_service


def pdf_bytes(texts=None, page_count=1, encrypted=False):
    """Produce real PDFs with page content streams, without external fixtures."""
    writer = PdfWriter()
    texts = texts or [""] * page_count
    for text in texts:
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        })
        page[NameObject("/Resources")] = DictionaryObject({
            NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})
        })
        stream = DecodedStreamObject()
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream.set_data(f"BT /F1 12 Tf 50 700 Td ({escaped}) Tj ET".encode("ascii"))
        page[NameObject("/Contents")] = writer._add_object(stream)
    if encrypted:
        writer.encrypt("test-password")
    result = BytesIO()
    writer.write(result)
    return result.getvalue()


TEXT = "Computer networks connect devices. Routers forward packets between networks using routing tables. " * 4


@pytest.fixture
def client(monkeypatch):
    # Never use the developer's database or environment secrets in unit tests.
    monkeypatch.setenv("MONGODB_URI", "")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    get_settings.cache_clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    get_settings.cache_clear()


def test_health_and_missing_database(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["database"] == "not_configured"
    assert response.json()["status"] == "degraded"
    assert response.json()["ai"] == "not_configured"
    assert client.post("/api/lessons/sample").status_code == 503
    result = client.post("/api/lessons/upload", files={"file": ("lesson.pdf", pdf_bytes([TEXT]), "application/pdf")})
    assert result.status_code == 503
    assert "MONGODB_URI" in result.json()["detail"]


def test_page_by_page_extraction():
    lesson = pdf_service.extract_pdf("lesson.pdf", pdf_bytes([TEXT, TEXT + "Second page."]))
    assert lesson.page_count == 2
    assert [page.page_number for page in lesson.pages] == [1, 2]
    assert "Second page." in lesson.pages[1].text
    assert lesson.extracted_text == "\n\n".join(page.text for page in lesson.pages)
    assert lesson.character_count == len(lesson.extracted_text)
    assert lesson.file_size_bytes > 0


@pytest.mark.parametrize("filename,content,mime,status,fragment", [
    ("lesson.txt", b"text", "text/plain", 400, "PDF"),
    ("lesson.pdf", b"text", "text/plain", 400, "type"),
    ("lesson.pdf", b"text", "application/pdf", 400, "readable"),
    ("lesson.pdf", b"%PDF-broken", "application/pdf", 400, "damaged"),
    ("lesson.pdf", pdf_bytes(), "application/pdf", 422, "scanned"),
    ("lesson.pdf", pdf_bytes(["Short label"]), "application/pdf", 422, "scanned"),
    ("lesson.pdf", pdf_bytes(page_count=81), "application/pdf", 413, "80"),
    ("lesson.pdf", pdf_bytes([TEXT], encrypted=True), "application/pdf", 400, "password"),
    ("lesson.pdf", b"%PDF-" + b"x" * pdf_service.MAX_FILE_SIZE, "application/pdf", 413, "10 MB"),
    ("lesson.pdf", pdf_bytes(["x" * 200001]), "application/pdf", 413, "200,000"),
], ids=["extension", "mime", "signature", "corrupt", "blank", "sparse", "pages", "encrypted", "size", "characters"])
def test_invalid_uploads(client, filename, content, mime, status, fragment):
    response = client.post("/api/lessons/upload", files={"file": (filename, content, mime)})
    assert response.status_code == status
    assert fragment in response.json()["detail"]


def test_exact_limits():
    lesson = pdf_service.extract_pdf("lesson.pdf", pdf_bytes(["x" * 200000]))
    assert lesson.character_count == 200000
    eighty = pdf_service.extract_pdf("lesson.pdf", pdf_bytes([TEXT] + [""] * 79))
    assert eighty.page_count == 80


def test_sample_model():
    sample = create_sample_lesson()
    for term in ("network", "packet", "IP address", "router", "routing table", "switch"):
        assert term.lower() in sample.extracted_text.lower()
    with pytest.raises(ValidationError):
        type(sample)(**(sample.model_dump() | {"character_count": 1}))


def stub_database(client):
    # This exercises API/schema contracts only. It is NOT MongoDB integration.
    lessons = SimpleNamespace(insert_one=AsyncMock(), find_one=AsyncMock())
    lessons.insert_one.return_value = SimpleNamespace(inserted_id=ObjectId())
    db = SimpleNamespace(lessons=lessons)
    database = SimpleNamespace(require=lambda: db)
    app.dependency_overrides[get_database] = lambda: database
    return lessons


def test_sample_and_upload_persistence_contract(client):
    collection = stub_database(client)
    sample = client.post("/api/lessons/sample")
    assert sample.status_code == 201
    assert ObjectId.is_valid(sample.json()["lesson_id"])
    assert sample.json()["title"] == "Introduction to Computer Networks"
    saved = collection.insert_one.call_args.args[0]
    assert saved["source"] == "sample" and saved["status"] == "ready"
    upload = client.post("/api/lessons/upload", files={"file": ("lesson.pdf", pdf_bytes([TEXT, TEXT]), "application/pdf")})
    assert upload.status_code == 201
    assert upload.json()["page_count"] == 2
    saved = collection.insert_one.call_args.args[0]
    assert len(saved["pages"]) == 2
    assert "extracted_text" in saved and "content" not in saved
    collection.find_one.return_value = {"_id": ObjectId(upload.json()["lesson_id"]), **saved}
    detail = client.get(f"/api/lessons/{upload.json()['lesson_id']}")
    assert detail.status_code == 200 and detail.json()["pages"][0]["page_number"] == 1


def test_persistence_failure(client):
    collection = stub_database(client)
    collection.insert_one.side_effect = ServerSelectionTimeoutError("secret connection string")
    response = client.post("/api/lessons/sample")
    assert response.status_code == 503
    assert "secret connection string" not in response.text
    assert "not confirmed saved" in response.json()["detail"]
    collection.find_one.side_effect = ServerSelectionTimeoutError("secret")
    assert client.get(f"/api/lessons/{ObjectId()}").status_code == 503


def test_lesson_ids(client):
    assert client.get("/api/lessons/not-an-id").status_code == 400
    collection = stub_database(client)
    collection.find_one.return_value = None
    assert client.get(f"/api/lessons/{ObjectId()}").status_code == 404


def test_invalid_uri_is_sanitized(monkeypatch):
    monkeypatch.setenv("MONGODB_URI", "invalid-secret-uri")
    get_settings.cache_clear()
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.json()["database"] == "invalid_configuration"
        assert "invalid-secret-uri" not in response.text
        assert client.post("/api/lessons/sample").status_code == 503
    get_settings.cache_clear()


def test_invalid_database_name_is_sanitized(monkeypatch):
    monkeypatch.setenv("MONGODB_URI", "mongodb://localhost:27017")
    monkeypatch.setenv("MONGODB_DB_NAME", "invalid/database")
    get_settings.cache_clear()
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.json()["database"] == "invalid_configuration"
        assert "invalid/database" not in response.text
    get_settings.cache_clear()


def test_cors(client):
    allowed = client.options("/api/lessons/upload", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    rejected = client.options("/api/lessons/upload", headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in rejected.headers


def test_secrets_redacted():
    settings = Settings(_env_file=None, mongodb_uri="mongodb://user:password@localhost", gemini_api_key="key-secret")
    assert "password" not in repr(settings) and "key-secret" not in repr(settings)
