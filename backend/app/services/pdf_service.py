from io import BytesIO
from pathlib import PurePosixPath

from fastapi import HTTPException, UploadFile
from pypdf import PdfReader

from app.limits import MAX_FILE_SIZE, MAX_PAGES, MAX_EXTRACTED_CHARACTERS, MIN_SELECTABLE_CHARACTERS
from app.schemas.lesson import Lesson, LessonPage

NO_TEXT_MESSAGE = (
    "We couldn't read enough text from this PDF. "
    "It may contain scanned pages instead of selectable text."
)


async def read_upload(file: UploadFile) -> tuple[str, bytes]:
    try:
        filename = PurePosixPath((file.filename or "").replace("\\", "/")).name
        if not filename.lower().endswith(".pdf") or len(filename) > 255:
            raise HTTPException(400, "Choose a PDF file with a filename of 255 characters or fewer.")
        if file.content_type not in ("application/pdf", "application/octet-stream", None):
            raise HTTPException(400, "Choose a PDF file. This file's type is not supported.")
        content = bytearray()
        while chunk := await file.read(64 * 1024):
            content.extend(chunk)
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(413, "This PDF is too large. The maximum file size is 10 MB.")
        return filename, bytes(content)
    finally:
        await file.close()


def extract_pdf(filename: str, content: bytes) -> Lesson:
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "This PDF is too large. The maximum file size is 10 MB.")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(400, "This file is not a readable PDF. Please export it as a PDF and try again.")
    try:
        reader = PdfReader(BytesIO(content))
        if reader.is_encrypted:
            raise HTTPException(400, "This PDF is password-protected. Upload an unencrypted copy.")
        page_count = len(reader.pages)
        if page_count > MAX_PAGES:
            raise HTTPException(413, "This PDF has too many pages. The maximum is 80 pages.")
        pages = []
        characters = 0
        for number, page in enumerate(reader.pages, 1):
            text = (page.extract_text() or "").replace("\x00", "").strip()
            characters += len(text) + (2 if pages else 0)
            if characters > MAX_EXTRACTED_CHARACTERS:
                raise HTTPException(413, "This lesson has too much text. The maximum is 200,000 characters; split it into smaller PDFs.")
            pages.append(LessonPage(page_number=number, text=text))
        combined = "\n\n".join(page.text for page in pages)
        if sum(not char.isspace() for char in combined) < MIN_SELECTABLE_CHARACTERS:
            raise HTTPException(422, NO_TEXT_MESSAGE)
        return Lesson(
            filename=filename, title=filename[:-4], source="pdf",
            file_size_bytes=len(content), page_count=page_count,
            character_count=len(combined), pages=pages, extracted_text=combined,
        )
    except HTTPException:
        raise
    except Exception:
        # Parser exception messages can include PDF internals. Never expose them.
        raise HTTPException(400, "We couldn't read this PDF. It may be damaged; try exporting a fresh copy.") from None
