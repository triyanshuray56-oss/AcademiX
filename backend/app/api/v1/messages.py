"""Connection requests and direct messages for student/recruiter communication."""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.app.core.security import get_current_user, require_roles
from backend.app.database import get_db
from backend.app.models import CandidateConnection, DirectMessage, User

router = APIRouter(prefix="/messages", tags=["messages"])
recruiter_messages_router = APIRouter(prefix="/recruiter/messages", tags=["messages"])
admin_messages_router = APIRouter(prefix="/admin/messages", tags=["messages"])


class ConnectionRequestItem(BaseModel):
    id: int
    sender_role: Literal["recruiter", "admin"]
    sender_email: str
    opportunity_title: str
    message: str
    created_at: datetime


class RespondToRequest(BaseModel):
    status: Literal["accepted", "declined"]


class MessageItem(BaseModel):
    id: int
    sender_email: str
    content: str
    timestamp: datetime


class MessageThread(BaseModel):
    id: int
    sender_role: Literal["recruiter", "admin"]
    other_party_email: str
    opportunity_title: str
    created_at: datetime
    messages: list[MessageItem]


class StaffMessageThread(BaseModel):
    id: int
    status: Literal["pending", "accepted", "declined"]
    sender_role: Literal["recruiter", "admin"]
    other_party_email: str
    opportunity_title: str
    intro_message: str
    created_at: datetime
    messages: list[MessageItem]


class SendMessage(BaseModel):
    connection_id: int = Field(gt=0)
    content: str = Field(min_length=1, max_length=4000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message content cannot be blank")
        return value


def _staff_threads(db: Session, current_user: User) -> list[StaffMessageThread]:
    connections = list(db.scalars(
        select(CandidateConnection)
        .where(CandidateConnection.sender_id == current_user.id)
        .order_by(CandidateConnection.created_at.desc(), CandidateConnection.id.desc())
    ))
    threads: list[StaffMessageThread] = []
    for connection in connections:
        recipient = db.get(User, connection.recipient_id)
        if recipient is None:
            raise HTTPException(status_code=500, detail="Connection participant account is unavailable")
        message_rows = db.execute(
            select(DirectMessage, User.email)
            .join(User, User.id == DirectMessage.sender_id)
            .where(DirectMessage.connection_id == connection.id)
            .order_by(DirectMessage.timestamp, DirectMessage.id)
        )
        threads.append(StaffMessageThread(
            id=connection.id,
            status=connection.status,
            sender_role=connection.sender_role,
            other_party_email=recipient.email,
            opportunity_title=connection.opportunity_title,
            intro_message=connection.intro_message,
            created_at=connection.created_at,
            messages=[
                MessageItem(
                    id=message.id,
                    sender_email=email,
                    content=message.content,
                    timestamp=message.timestamp,
                )
                for message, email in message_rows
            ],
        ))
    return threads


@router.get("/requests", response_model=list[ConnectionRequestItem])
def get_connection_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> list[ConnectionRequestItem]:
    rows = db.execute(
        select(CandidateConnection, User.email)
        .join(User, User.id == CandidateConnection.sender_id)
        .where(
            CandidateConnection.recipient_id == current_user.id,
            CandidateConnection.status == "pending",
        )
        .order_by(CandidateConnection.created_at.desc(), CandidateConnection.id.desc())
    )
    return [
        ConnectionRequestItem(
            id=connection.id,
            sender_role=connection.sender_role,
            sender_email=email,
            opportunity_title=connection.opportunity_title,
            message=connection.intro_message,
            created_at=connection.created_at,
        )
        for connection, email in rows
    ]


@recruiter_messages_router.get("/threads", response_model=list[StaffMessageThread])
def get_recruiter_message_threads(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("recruiter")),
) -> list[StaffMessageThread]:
    return _staff_threads(db, current_user)


@admin_messages_router.get("/threads", response_model=list[StaffMessageThread])
def get_admin_message_threads(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
) -> list[StaffMessageThread]:
    return _staff_threads(db, current_user)


@router.post("/requests/{req_id}/respond")
def respond_to_connection_request(
    req_id: int,
    payload: RespondToRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("student")),
) -> dict[str, str]:
    connection = db.get(CandidateConnection, req_id)
    if connection is None or connection.recipient_id != current_user.id:
        raise HTTPException(status_code=404, detail="Connection request not found")
    if connection.status != "pending":
        raise HTTPException(status_code=409, detail="Connection request has already been answered")
    connection.status = payload.status
    db.commit()
    return {"status": connection.status}


@router.get("/threads", response_model=list[MessageThread])
def get_message_threads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MessageThread]:
    connections = list(db.scalars(
        select(CandidateConnection)
        .where(
            CandidateConnection.status == "accepted",
            or_(
                CandidateConnection.sender_id == current_user.id,
                CandidateConnection.recipient_id == current_user.id,
            ),
        )
        .order_by(CandidateConnection.created_at.desc(), CandidateConnection.id.desc())
    ))
    threads: list[MessageThread] = []
    for connection in connections:
        other_party_id = (
            connection.recipient_id
            if connection.sender_id == current_user.id
            else connection.sender_id
        )
        other_party = db.get(User, other_party_id)
        if other_party is None:
            raise HTTPException(status_code=500, detail="Connection participant account is unavailable")
        messages = list(db.scalars(
            select(DirectMessage)
            .where(DirectMessage.connection_id == connection.id)
            .order_by(DirectMessage.timestamp, DirectMessage.id)
        ))
        message_senders = {
            message.sender_id: db.get(User, message.sender_id)
            for message in messages
        }
        if any(sender is None for sender in message_senders.values()):
            raise HTTPException(status_code=500, detail="Message sender account is unavailable")
        intro_sender_email = (
            current_user.email
            if connection.sender_id == current_user.id
            else other_party.email
        )
        thread_messages = [
            MessageItem(
                id=message.id,
                sender_email=message_senders[message.sender_id].email,
                content=message.content,
                timestamp=message.timestamp,
            )
            for message in messages
        ]
        if connection.intro_message.strip():
            thread_messages.insert(0, MessageItem(
                id=-connection.id,
                sender_email=intro_sender_email,
                content=connection.intro_message,
                timestamp=connection.created_at,
            ))
        threads.append(MessageThread(
            id=connection.id,
            sender_role=connection.sender_role,
            other_party_email=other_party.email,
            opportunity_title=connection.opportunity_title,
            created_at=connection.created_at,
            messages=thread_messages,
        ))
    return threads


@router.post("/send", response_model=MessageItem, status_code=status.HTTP_201_CREATED)
def send_direct_message(
    payload: SendMessage,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageItem:
    connection = db.get(CandidateConnection, payload.connection_id)
    if connection is None or current_user.id not in (connection.sender_id, connection.recipient_id):
        raise HTTPException(status_code=404, detail="Accepted connection not found")
    if connection.status != "accepted":
        raise HTTPException(status_code=409, detail="Accept the connection before sending messages")
    recipient_id = (
        connection.recipient_id
        if current_user.id == connection.sender_id
        else connection.sender_id
    )
    message = DirectMessage(
        connection_id=connection.id,
        sender_id=current_user.id,
        recipient_id=recipient_id,
        content=payload.content,
        timestamp=datetime.now(UTC),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return MessageItem(
        id=message.id,
        sender_email=current_user.email,
        content=message.content,
        timestamp=message.timestamp,
    )
