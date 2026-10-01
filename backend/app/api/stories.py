from fastapi import APIRouter, Depends

from app.database import Database, get_database
from app.schemas.story import GenerateStoryRequest, StoryArc, StoryCreated
from app.services.ai_service import AIService, get_ai_service
from app.services.story_repository import StoryRepository
from app.services.story_service import generate_story

router = APIRouter(prefix="/api", tags=["stories"])


@router.post("/stories/generate", response_model=StoryCreated, status_code=201)
async def generate(request: GenerateStoryRequest, database: Database = Depends(get_database),
                   ai: AIService = Depends(get_ai_service)):
    return await generate_story(database, ai, request)


@router.get("/arcs/{arc_id}", response_model=StoryArc)
async def get_arc(arc_id: str, database: Database = Depends(get_database)):
    return await StoryRepository(database).find_arc(arc_id)
