"""Adaptive multiple-choice quiz generation for student mock tests."""

import asyncio
import logging
import random
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from backend.app.ai.llm_client import create_chat_completion, is_ai_configured, parse_json_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tests", tags=["tests"])

FALLBACK_QUESTIONS = [
    {
        "question": "Which data structure follows the last-in, first-out (LIFO) principle?",
        "options": ["Queue", "Stack", "Binary search tree", "Graph"],
        "correct_answer": 1,
        "explanation": "A stack removes the most recently added item first.",
    },
    {
        "question": "What is the average time complexity of searching a key in a hash table?",
        "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
        "correct_answer": 0,
        "explanation": "A well-distributed hash table supports average constant-time lookup.",
    },
    {
        "question": "Which SQL clause filters rows before they are grouped?",
        "options": ["HAVING", "ORDER BY", "WHERE", "LIMIT"],
        "correct_answer": 2,
        "explanation": "WHERE filters input rows before GROUP BY and aggregate evaluation.",
    },
    {
        "question": "What is the time complexity of binary search on a sorted array?",
        "options": ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
        "correct_answer": 1,
        "explanation": "Binary search halves the remaining search range at each step.",
    },
    {
        "question": "Which mechanism lets a process continue after a function call without blocking its caller?",
        "options": ["Recursion", "Asynchronous I/O", "Busy waiting", "Polling every instruction"],
        "correct_answer": 1,
        "explanation": "Asynchronous I/O allows other work to proceed while an operation is pending.",
    },
    {
        "question": "Which normal form primarily removes partial dependency on a composite key?",
        "options": ["First normal form", "Second normal form", "Third normal form", "Boyce-Codd normal form"],
        "correct_answer": 1,
        "explanation": "Second normal form requires non-key attributes to depend on the whole candidate key.",
    },
    {
        "question": "Which traversal of a binary search tree returns its keys in sorted order?",
        "options": ["Pre-order", "In-order", "Post-order", "Level-order"],
        "correct_answer": 1,
        "explanation": "In-order traversal visits the left subtree, node, and right subtree.",
    },
    {
        "question": "Which HTTP method is conventionally used to replace a resource?",
        "options": ["GET", "POST", "PUT", "DELETE"],
        "correct_answer": 2,
        "explanation": "PUT conventionally replaces or creates a resource at a known URI.",
    },
    {
        "question": "What does a database transaction's ACID property 'D' stand for?",
        "options": ["Dependency", "Durability", "Distribution", "Determinism"],
        "correct_answer": 1,
        "explanation": "Durability means committed changes persist despite failures.",
    },
    {
        "question": "Which algorithmic technique solves a problem by combining solutions to overlapping subproblems?",
        "options": ["Greedy search", "Dynamic programming", "Backtracking only", "Linear probing"],
        "correct_answer": 1,
        "explanation": "Dynamic programming stores subproblem results to avoid repeated computation.",
    },
]


class AdaptiveTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    topic: str = Field(min_length=1, max_length=120)
    difficulty: str = Field(min_length=1, max_length=40)
    count: int = Field(default=3, ge=1, le=10)


def _validate_questions(content: str | dict[str, Any], count: int) -> list[dict[str, Any]]:
    if isinstance(content, str):
        questions = parse_json_response(content)
    else:
        questions = content
    if isinstance(questions, dict):
        questions = questions.get("questions")
    if not isinstance(questions, list) or len(questions) != count:
        raise ValueError("The AI response did not contain the requested number of questions")

    validated = []
    for index, question in enumerate(questions, start=1):
        if not isinstance(question, dict):
            raise ValueError("The AI response contains an invalid question")
        question_text = question.get("question") or question.get("question_text") or question.get("prompt")
        options = _normalize_options(question.get("options"))
        answer_value = next(
            (question[key] for key in ("correct_answer", "correct_option", "answer") if question.get(key) is not None),
            None,
        )
        answer = _normalize_answer(
            answer_value,
            options,
            one_based=question.get("correct_answer") is None and question.get("correct_option") is not None,
        )
        explanation = question.get("explanation") or question.get("answer_explanation")
        if (
            not isinstance(question_text, str)
            or not question_text.strip()
            or options is None
            or len(options) != 4
            or answer is None
            or not isinstance(explanation, str)
            or not explanation.strip()
        ):
            raise ValueError(f"The AI response contains a question with invalid fields at index {index - 1}")
        validated.append(
            {
                "id": index,
                "question": question_text.strip(),
                "options": options,
                "correct_answer": answer,
                "explanation": explanation.strip(),
            }
        )
    return validated


def _normalize_options(value: Any) -> list[str] | None:
    if isinstance(value, dict):
        value = list(value.values())
    elif isinstance(value, str):
        lines = [line.strip() for line in value.splitlines() if line.strip()]
        value = lines if len(lines) > 1 else [part.strip() for part in value.split("|") if part.strip()]
    if not isinstance(value, (list, tuple)):
        return None

    normalized = []
    for option in value:
        if isinstance(option, dict):
            option = option.get("text", option.get("label", option.get("option")))
        if not isinstance(option, (str, int, float)) or isinstance(option, bool):
            return None
        option_text = str(option).strip()
        if not option_text:
            return None
        normalized.append(option_text)
    return normalized


def _normalize_answer(value: Any, options: list[str] | None, *, one_based: bool = False) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        if one_based:
            return value - 1 if 1 <= value <= 4 else None
        return value if 0 <= value < 4 else (value - 1 if value == 4 else None)
    if isinstance(value, dict):
        value = value.get("index", value.get("option", value.get("text", value.get("value"))))
    if not isinstance(value, str):
        return None

    answer = value.strip()
    if not answer:
        return None
    if options:
        matching_options = [index for index, option in enumerate(options) if option.casefold() == answer.casefold()]
        if len(matching_options) == 1:
            return matching_options[0]
    if len(answer) == 1 and answer.upper() in "ABCD":
        return ord(answer.upper()) - ord("A")
    if answer.isdecimal():
        numeric_answer = int(answer)
        if one_based:
            return numeric_answer - 1 if 1 <= numeric_answer <= 4 else None
        if 0 <= numeric_answer < 4:
            return numeric_answer
        if numeric_answer == 4:
            return 3
    return None


def _fallback_questions(count: int) -> list[dict[str, Any]]:
    selected = random.sample(FALLBACK_QUESTIONS, k=min(count, len(FALLBACK_QUESTIONS)))
    return [
        {
            "id": index,
            **question,
        }
        for index, question in enumerate(selected, start=1)
    ]


def _generate_with_ai(topic: str, difficulty: str, count: int) -> list[dict[str, Any]]:
    raw_response = create_chat_completion(
        [
            {
                "role": "system",
                "content": (
                    "Generate accurate multiple-choice questions for computer science students. "
                    "Return only a JSON object with a 'questions' array. Every question object "
                    "must use the exact keys and value types shown in the user's schema template."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Create exactly {count} original multiple-choice questions about {topic!r} "
                    f"at {difficulty!r} difficulty for a computer science student. Return a JSON "
                    "object matching this exact schema and key spelling; do not add, rename, or "
                    "omit fields:\n"
                    "{\n"
                    '  "questions": [\n'
                    "    {\n"
                    '      "id": 1,\n'
                    '      "question": "Which data structure uses LIFO order?",\n'
                    '      "options": ["Queue", "Stack", "Tree", "Graph"],\n'
                    '      "correct_answer": 1,\n'
                    '      "explanation": "A stack removes the most recently added item first."\n'
                    "    }\n"
                    "  ]\n"
                    "}\n"
                    f"Create exactly {count} question objects. Each options array must contain "
                    "exactly four non-empty strings. correct_answer must be an integer from 0 "
                    "to 3 inclusive, indicating the zero-based index of the correct option. "
                    "Each question must have a non-empty question and explanation."
                ),
            },
        ],
        json_mode=True,
        temperature=0.5,
        max_tokens=3000,
    )
    try:
        result = parse_json_response(raw_response)
        return _validate_questions(result, count)
    except (TypeError, ValueError):
        logger.error("Groq adaptive test response failed validation; raw response: %s", raw_response)
        raise


@router.post("/generate-adaptive")
async def generate_adaptive_test(payload: AdaptiveTestRequest) -> list[dict[str, Any]]:
    """Generate a topic- and difficulty-aware test, falling back locally when needed."""
    if not is_ai_configured():
        logger.warning("Groq API key is not configured; serving fallback mock-test questions")
        return _fallback_questions(payload.count)

    try:
        return await asyncio.to_thread(
            _generate_with_ai,
            payload.topic,
            payload.difficulty,
            payload.count,
        )
    except Exception:
        logger.exception("Groq adaptive test generation failed; serving fallback questions")
        return _fallback_questions(payload.count)
