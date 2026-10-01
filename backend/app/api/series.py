from fastapi import APIRouter, Depends

from app.database import Database, get_database
from app.schemas.series import SeriesDetail
from app.schemas.story import ContinueStoryRequest, StoryCreated
from app.services.ai_service import AIService, get_ai_service
from app.services.story_repository import StoryRepository
from app.services.story_service import continue_story

router = APIRouter(prefix="/api/series", tags=["series"])


@router.get("/{series_id}", response_model=SeriesDetail)
async def get_series(series_id: str, database: Database = Depends(get_database)):
    series = await StoryRepository(database).find_series(series_id)
    return SeriesDetail(**series.model_dump(exclude={"story_bible"}))


@router.post("/{series_id}/continue", response_model=StoryCreated, status_code=201)
async def continue_series(series_id: str, request: ContinueStoryRequest,
                          database: Database = Depends(get_database), ai: AIService = Depends(get_ai_service)):
    return await continue_story(database, ai, series_id, request)
