from fastapi import APIRouter, Depends

from app.database import Database, get_database
from app.config import get_settings

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health(database: Database = Depends(get_database)):
    status, message = await database.health()
    return {
        "status": "ok" if status == "connected" else "degraded",
        "database": status,
        "ai": "configured" if get_settings().gemini_api_key.get_secret_value().strip() else "not_configured",
        "message": message,
    }
