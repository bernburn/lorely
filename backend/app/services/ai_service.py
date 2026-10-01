"""Provider boundary: structured output, bounded retries, no raw SDK errors/logs."""
import asyncio
import random
from collections.abc import Awaitable, Callable
from typing import TypeVar

import httpx
from fastapi import HTTPException
from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.config import Settings, get_settings
from app.schemas.story import GeneratedArc, GeneratedNewStory, GeminiArc, GeminiNewStory

Result = TypeVar("Result", bound=BaseModel)
BUSY = "Lorely's story service is temporarily busy. Please try again in a moment."
INVALID_OUTPUT = "Lorely couldn't prepare a valid story. Please try again."
MAX_TRANSPORT_RETRIES = 2
MAX_STRUCTURED_ATTEMPTS = 2
TRANSIENT_STATUS = {429, 500, 502, 503, 504}


def gemini_schema(schema: type[BaseModel]) -> dict:
    """Project Pydantic/OpenAPI JSON Schema onto Gemini's supported subset.

    Keep discriminated unions in public Pydantic models; Gemini receives a flat
    tagged block shape. All strict limits remain enforced after generation.
    See https://ai.google.dev/gemini-api/docs/structured-output#json_schema_support
    """
    # Upper array bounds multiplied across chapters/blocks/choices and narrative
    # memory can make the provider's constrained decoder reject the full schema.
    # Express these bounds as guidance; strict Pydantic bounds still decide
    # whether any generated result may be accepted or persisted.
    supported = {"type", "description", "required", "enum", "format", "minimum", "maximum",
                 "minItems", "$ref"}

    def convert(node):
        result = {key: value for key, value in node.items() if key in supported}
        if "const" in node:
            result["enum"] = [node["const"]]
        for key in ("properties", "$defs"):
            if key in node:
                result[key] = {name: convert(value) for name, value in node[key].items()}
        for key in ("items", "additionalProperties"):
            if key in node:
                result[key] = convert(node[key]) if isinstance(node[key], dict) else node[key]
        for key in ("anyOf", "oneOf", "prefixItems"):
            if key in node:
                branches = node[key]
                if key == "anyOf" and len(branches) == 2 and any(branch.get("type") == "null" for branch in branches):
                    value = next(branch for branch in branches if branch.get("type") != "null")
                    if "type" in value:
                        result.update(convert(value))
                        result["type"] = [value["type"], "null"]
                        continue
                result["anyOf" if key == "oneOf" else key] = [convert(value) for value in branches]
        hints = [f"{key}: {node[key]}" for key in ("minLength", "maxLength", "pattern", "maxItems") if key in node]
        if hints:
            result["description"] = (result.get("description", "") + " " + "; ".join(hints)).strip()
        return result

    wire_model = wire_schema(schema)
    result = convert(wire_model.model_json_schema())
    if wire_model in (GeminiArc, GeminiNewStory):
        block = result["$defs"]["GeminiBlock"]
        block["required"] = list(block["properties"])
    return result


def wire_schema(schema: type[Result]) -> type[BaseModel]:
    return {GeneratedArc: GeminiArc, GeneratedNewStory: GeminiNewStory}.get(schema, schema)


def parse_result(schema: type[Result], output: str) -> Result:
    wire = wire_schema(schema)
    if wire is schema:
        return schema.model_validate_json(output)
    result = wire.model_validate_json(output)
    return schema.model_validate(result.native())


class AIService:
    def __init__(self, settings: Settings | None = None, *,
                 transport: Callable[..., Awaitable[str]] | None = None,
                 sleep: Callable[[float], Awaitable[None]] = asyncio.sleep):
        self.settings = settings or get_settings()
        self.transport = transport or self._request
        self.sleep = sleep

    async def _request(self, prompt: str, schema: type[Result], max_output_tokens: int) -> str:
        # SDK 2.26's parent Client mutates attempts=0 to 1 during construction,
        # then Interactions interprets that 1 as one retry. Restore zero after
        # construction, before the lazy Interactions client reads these options.
        options = types.HttpOptions(
            timeout=int(self.settings.gemini_request_timeout_seconds * 1000),
            retry_options=types.HttpRetryOptions(attempts=0),
        )
        async with genai.Client(
            api_key=self.settings.gemini_api_key.get_secret_value(),
            vertexai=False, http_options=options,
        ).aio as client:
            options.retry_options.attempts = 0
            result = await client.interactions.create(
                model=self.settings.gemini_model,
                input=prompt,
                response_format={"type": "text", "mime_type": "application/json",
                                 "schema": gemini_schema(schema)},
                generation_config={"max_output_tokens": max_output_tokens},
                store=False,
            )
            return result.output_text or ""

    async def generate(self, prompt: str, schema: type[Result], *,
                       validate: Callable[[Result], object] | None = None,
                       max_output_tokens: int = 8192) -> Result:
        if not self.settings.gemini_api_key.get_secret_value().strip():
            raise HTTPException(503, "Set GEMINI_API_KEY in backend/.env, then restart the backend to generate stories.")
        if not self.settings.gemini_model.strip():
            raise HTTPException(503, "Set GEMINI_MODEL in backend/.env to an accessible model.")
        original_prompt = prompt
        transport_retries = 0
        # At most two structured responses, plus two shared transient retries:
        # four outbound calls total. A late transport recovery cannot consume
        # the one regeneration reserved for a malformed successful response.
        for structured_attempt in range(MAX_STRUCTURED_ATTEMPTS):
            while True:
                try:
                    async with asyncio.timeout(self.settings.gemini_request_timeout_seconds):
                        output = await self.transport(prompt, schema, max_output_tokens)
                    break
                except Exception as error:
                    # Interactions and Models APIs use different SDK exception classes.
                    # Inspect status attributes, never exception text, bodies or requests.
                    code = getattr(error, "status_code", None) or getattr(error, "code", None)
                    transient = code in TRANSIENT_STATUS or isinstance(error, (TimeoutError, httpx.TransportError))
                    transient = transient or type(error).__name__ in {"APITimeoutError", "APIConnectionError"}
                    if transient:
                        if transport_retries >= MAX_TRANSPORT_RETRIES:
                            raise HTTPException(503, BUSY, headers={"Retry-After": "5"}) from None
                        await self.sleep(2 ** transport_retries + random.uniform(0, 0.25))
                        transport_retries += 1
                        continue
                    if code in {401, 403}:
                        detail = "Gemini access could not be authorized. Check the backend API key and project permissions."
                    elif code == 404:
                        detail = "The configured Gemini model is not accessible. Check GEMINI_MODEL in backend/.env."
                    else:
                        detail = "Lorely's story service could not process this request. Check the backend Gemini configuration."
                    raise HTTPException(502, detail) from None
            try:
                result = parse_result(schema, output)
                if validate is not None:
                    validate(result)
                return result
            except (ValidationError, ValueError, TypeError) as error:
                if structured_attempt + 1 == MAX_STRUCTURED_ATTEMPTS:
                    raise HTTPException(502, INVALID_OUTPUT) from None
                stage = "Lorely business validation"
                if isinstance(error, ValidationError):
                    stage = "JSON parsing" if any(e["type"] == "json_invalid" for e in error.errors(include_input=False)) else "schema validation"
                # Keep the contract on both calls; never echo rejected text/errors.
                prompt = original_prompt + f"\nREPAIR: The previous response failed the required structured contract during {stage}. " \
                          "Regenerate a complete JSON result using the supplied response_format schema, without Markdown or explanatory prose. " \
                          "Check all required fields, " \
                          "chapter numbering, nonempty quizzes, zero-based answer indexes, valid concept references, " \
                          "interaction restrictions, and coherent known character/thread updates."
        raise HTTPException(503, BUSY)


def get_ai_service() -> AIService:
    return AIService()
