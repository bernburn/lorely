from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import health, lessons, series, stories
from app.config import get_settings
from app.database import lifespan

app = FastAPI(title="Lorely", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_url.rstrip("/")],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.include_router(health.router)
app.include_router(lessons.router)
app.include_router(stories.router)
app.include_router(series.router)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exception: Exception):
    return JSONResponse(status_code=500, content={"detail": "Something went wrong while processing your request. Please try again."})
