"""Role-aware conversational assistant for CampusLink portal users."""

import asyncio
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from backend.app.ai.llm_client import create_chat_completion, is_ai_configured
from backend.app.core.security import get_current_user
from backend.app.models import User

router = APIRouter(prefix="/ai", tags=["AI assistant"])
UserRole = Literal["student", "admin", "recruiter"]

ROLE_GUIDANCE = {
    "student": "Help with CGPA and eligibility interpretation, LeetCode and technical skill growth, longitudinal readiness metrics, application tracking, interview countdowns, and job compatibility recommendations. Give concrete next steps and remind the student to verify employer-specific eligibility with the placement cell.",
    "admin": "Help coordinate placement drives, verify student records, draft bulk placement notices, and interpret institutional analytics. Treat sensitive student data carefully and never claim to have changed records or broadcast a notice.",
    "recruiter": "Help filter and assess candidates using job-relevant criteria, draft job or internship postings, and manage shortlist, interview, and offer pipeline stages. Avoid unsupported claims about candidate data and never claim to have changed pipeline records.",
}


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=3000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=3000)
    user_role: UserRole
    history: list[ChatMessage] = Field(default_factory=list, max_length=12)


class ChatResponse(BaseModel):
    reply: str
    role_context: UserRole


def _fallback_reply(role: UserRole, message: str) -> str:
    """Provide useful, role-specific local guidance when no model key is configured."""
    query = message.casefold()
    if role == "student":
        if any(term in query for term in ("compatib", "match", "job", "internship", "skill")):
            return "Open Growth → Job & Internship Compatibility to review the ranked openings, matched skills, missing requirements, and suggested next steps. Feed cutoffs can be estimates, so confirm eligibility and deadlines on the employer listing."
        if any(term in query for term in ("interview", "countdown", "schedule")):
            return "Open Interviews → Interview Schedule to see stages linked to your applications, status, and countdowns. If no stages appear, first confirm your application is recorded under Jobs."
        if any(term in query for term in ("cgpa", "backlog", "readiness", "growth", "leetcode", "rating")):
            return "Your Growth hub tracks readiness and profile signals over time. Add your current CGPA, backlog status, LeetCode rating, projects, and experience to improve the estimates; company cutoffs still need to be checked on each drive."
        return "I can help you plan profile improvements, review compatibility gaps, understand readiness metrics, track applications, or prepare for interviews. Tell me which role or profile area you’re working on."
    if role == "admin":
        if any(term in query for term in ("notice", "broadcast", "announce")):
            return "Draft the notice with its audience, deadline, eligibility, and action link, then review those details in the Notices workflow before broadcasting. I can help write or tighten the announcement."
        if any(term in query for term in ("drive", "schedule", "conflict")):
            return "For drive coordination, verify the company, eligible branches, registration deadline, venue, and interview stages. Check the conflict resolver before confirming overlapping schedules."
        return "I can help plan placement drives, prepare student verification checklists, draft bulk notices, and interpret placement analytics. Tell me the institution workflow you want to work through."
        
    return "I can help define role-relevant candidate filters, draft a job or internship description, and plan shortlist, interview, and offer stages. Share the role requirements or pipeline step you want to work on."


def _system_prompt(role: UserRole) -> str:
    return (
        "You are CampusLink AI, an assistant embedded in a BPUT placement platform. "
        f"The authenticated user role is {role}. Role-specific scope: {ROLE_GUIDANCE[role]} "
        "Be concise, practical, and clear. You cannot read CampusLink databases or perform portal actions from chat. "
        "Never invent candidate records, job openings, deadlines, metrics, or claim that an action was completed. "
        "When information depends on a live portal record, direct the user to the relevant portal screen."
    )


def _call_ai_provider(role: UserRole, history: list[ChatMessage], message: str) -> str:
    messages = [{"role": "system", "content": _system_prompt(role)}]
    messages.extend({"role": item.role, "content": item.content} for item in history)
    messages.append({"role": "user", "content": message.strip()})
    return create_chat_completion(messages, temperature=0.35, max_tokens=650)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    """Answer a role-aware chat request, enforcing the role in the access token."""
    if payload.user_role != current_user.role:
        raise HTTPException(status_code=403, detail="Chat role must match the authenticated account")
    
    if not is_ai_configured():
        reply = _fallback_reply(current_user.role, payload.message)
    else:
        try:
            reply = await asyncio.to_thread(
                _call_ai_provider,
                current_user.role,
                payload.history,
                payload.message,
            )
        except Exception as error:
            raise HTTPException(status_code=502, detail="AI assistant is temporarily unavailable") from error
            
    return ChatResponse(reply=reply, role_context=current_user.role)