from fastapi import APIRouter, Depends, UploadFile
from starlette.concurrency import run_in_threadpool

from app.data.sample_lesson import create_sample_lesson
from app.database import Database, get_database
from app.schemas.lesson import LessonDetail, LessonMetadata
from app.services.lesson_service import find_lesson, save_lesson
from app.services.pdf_service import extract_pdf, read_upload

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


@router.post("/upload", response_model=LessonMetadata, status_code=201)
async def upload_lesson(file: UploadFile, database: Database = Depends(get_database)):
    filename, content = await read_upload(file)
    lesson = await run_in_threadpool(extract_pdf, filename, content)
    return await save_lesson(database, lesson)


@router.post("/sample", response_model=LessonMetadata, status_code=201)
async def sample_lesson(database: Database = Depends(get_database)):
    return await save_lesson(database, create_sample_lesson())


@router.get("/{lesson_id}", response_model=LessonDetail)
async def get_lesson(lesson_id: str, database: Database = Depends(get_database)):
    return await find_lesson(database, lesson_id)
