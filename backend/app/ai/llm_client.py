"""Shared OpenAI-compatible client for CampusLink's Groq-hosted models."""

import json
import os
from functools import lru_cache
from typing import Any

import backend.app.config  # noqa: F401  # load .env before reading AI settings
from openai import OpenAI

DEFAULT_API_BASE = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "openai/gpt-oss-120b"


def get_ai_api_key() -> str:
    """Return the configured Groq key or the backwards-compatible CampusLink key."""
    return (os.getenv("GROQ_API_KEY") or os.getenv("CAMPUSLINK_AI_API_KEY") or "").strip()


def is_ai_configured() -> bool:
    return bool(get_ai_api_key())


@lru_cache(maxsize=4)
def _client_for(api_base: str, api_key: str) -> OpenAI:
    return OpenAI(base_url=api_base, api_key=api_key)


def get_ai_client() -> OpenAI:
    api_key = get_ai_api_key()
    if not api_key:
        raise RuntimeError("Groq API key is not configured")
    api_base = os.getenv("CAMPUSLINK_AI_API_BASE", DEFAULT_API_BASE).strip() or DEFAULT_API_BASE
    return _client_for(api_base, api_key)


def create_chat_completion(
    messages: list[dict[str, str]],
    *,
    json_mode: bool = False,
    temperature: float = 0.2,
    max_tokens: int = 1600,
) -> str:
    """Create a completion using shared Groq settings and return its non-empty text."""
    request: dict[str, Any] = {
        "model": os.getenv("CAMPUSLINK_AI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        request["response_format"] = {"type": "json_object"}

    response = get_ai_client().chat.completions.create(**request)
    content = response.choices[0].message.content
    if not content or not content.strip():
        raise ValueError("AI provider returned an empty response")
    return content.strip()


def parse_json_response(content: str) -> Any:
    """Parse a JSON completion, tolerating a surrounding Markdown code fence."""
    candidate = content.strip()
    if candidate.startswith("```"):
        candidate = candidate.removeprefix("```json").removeprefix("```")
        candidate = candidate.removesuffix("```").strip()
    try:
        return json.loads(candidate)
    except json.JSONDecodeError as error:
        raise ValueError("AI provider returned invalid JSON") from error


def generate_json_object(system_prompt: str, user_prompt: str, *, max_tokens: int = 1600) -> dict[str, Any]:
    result = parse_json_response(create_chat_completion(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        json_mode=True,
        max_tokens=max_tokens,
    ))
    if not isinstance(result, dict):
        raise ValueError("AI provider response must be a JSON object")
    return result
