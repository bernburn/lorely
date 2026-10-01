from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import HTTPException, Request
from pymongo import AsyncMongoClient
from pymongo.errors import ConfigurationError, InvalidName, InvalidURI, PyMongoError

from app.config import get_settings

NOT_CONFIGURED = "Set MONGODB_URI in backend/.env, then restart the backend to save lessons."
INVALID_CONFIG = "MongoDB configuration is invalid. Check MONGODB_URI and MONGODB_DB_NAME in backend/.env."
UNAVAILABLE = "Could not reach MongoDB. Check your connection, credentials, and database network access."


class Database:
    def __init__(self):
        self.client = None
        self.db = None
        self.configuration_error = None
        settings = get_settings()
        uri = settings.mongodb_uri.get_secret_value().strip()
        if not uri:
            self.configuration_error = NOT_CONFIGURED
            return
        if not uri.startswith(("mongodb://", "mongodb+srv://")):
            self.configuration_error = INVALID_CONFIG
            return
        try:
            self.client = AsyncMongoClient(
                uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000,
                socketTimeoutMS=10000, timeoutMS=10000, tz_aware=True,
            )
            self.db = self.client[settings.mongodb_db_name]
        except (ConfigurationError, InvalidURI, InvalidName, ValueError):
            self.configuration_error = INVALID_CONFIG

    async def health(self) -> tuple[str, str | None]:
        if self.configuration_error:
            status = "not_configured" if self.configuration_error == NOT_CONFIGURED else "invalid_configuration"
            return status, self.configuration_error
        try:
            await self.client.admin.command("ping")
            return "connected", None
        except PyMongoError:
            return "unavailable", UNAVAILABLE

    def require(self):
        if self.configuration_error:
            raise HTTPException(status_code=503, detail=self.configuration_error)
        return self.db

    async def close(self):
        if self.client is not None:
            await self.client.close()


@asynccontextmanager
async def lifespan(app) -> AsyncIterator[None]:
    database = Database()
    app.state.database = database
    try:
        yield
    finally:
        await database.close()


def get_database(request: Request) -> Database:
    return request.app.state.database
