import hmac
import os
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import backend.app.config  # noqa: F401  # load local .env before settings imports
from backend.app.core.security import (
	create_access_token,
	get_current_user,
	get_password_hash,
	hash_reset_token,
	verify_password,
)
from backend.app.database import get_db
from backend.app.models import User

router = APIRouter(prefix="/auth", tags=["authentication"])
UserRole = Literal["student", "recruiter", "admin"]
MAX_BCRYPT_PASSWORD_BYTES = 72
RESET_TOKEN_LIFETIME = timedelta(minutes=30)


class AuthPayload(BaseModel):
	model_config = ConfigDict(extra="forbid")

	email: str = Field(min_length=3, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

	@field_validator("email")
	@classmethod
	def normalize_email(cls, value: str) -> str:
		return value.strip().casefold()


class SignupRequest(AuthPayload):
	password: str = Field(min_length=8, max_length=128)
	role: UserRole

	@field_validator("password")
	@classmethod
	def validate_bcrypt_password_length(cls, value: str) -> str:
		if len(value.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES:
			raise ValueError("password must not exceed 72 UTF-8 bytes")
		return value


class LoginRequest(AuthPayload):
	password: str = Field(min_length=1, max_length=128)
	expected_role: UserRole


class ForgotPasswordRequest(AuthPayload):
	pass


class ResetPasswordRequest(AuthPayload):
	reset_token: str = Field(min_length=20, max_length=256)
	new_password: str = Field(min_length=8, max_length=128)

	@field_validator("new_password")
	@classmethod
	def validate_bcrypt_password_length(cls, value: str) -> str:
		if len(value.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES:
			raise ValueError("new_password must not exceed 72 UTF-8 bytes")
		return value


class SignupResponse(BaseModel):
	detail: str
	role: UserRole


class LoginResponse(BaseModel):
	access_token: str
	token_type: Literal["bearer"] = "bearer"
	role: UserRole


class ForgotPasswordResponse(BaseModel):
	detail: str
	reset_token: str | None = None


class AuthMessageResponse(BaseModel):
	detail: str


class AuthenticatedUserResponse(BaseModel):
	email: str
	role: UserRole
	is_active: bool


async def _parse_login_payload(request: Request) -> LoginRequest:
	content_type = request.headers.get("content-type", "").casefold()
	try:
		if "application/json" in content_type:
			payload = await request.json()
		elif (
			"application/x-www-form-urlencoded" in content_type
			or "multipart/form-data" in content_type
		):
			payload = dict(await request.form())
			if "email" not in payload and "username" in payload:
				payload["email"] = payload.pop("username")
		else:
			raise HTTPException(
				status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
				detail="Login accepts JSON or form data",
			)
		return LoginRequest.model_validate(payload)
	except HTTPException:
		raise
	except (ValueError, ValidationError) as error:
		raise HTTPException(
			status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
			detail="Invalid login payload",
		) from error


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(
	payload: SignupRequest,
	session: Annotated[Session, Depends(get_db)],
	role_registration_key: Annotated[
		str | None,
		Header(alias="X-Role-Registration-Key"),
	] = None,
) -> SignupResponse:
	if payload.role != "student":
		demo_defaults = {"recruiter": "recruiter123", "admin": "admin123"}
		configured_key = os.getenv(f"CAMPUSLINK_{payload.role.upper()}_SIGNUP_KEY")
		if configured_key:
			expected_key = configured_key
		elif os.getenv("APP_ENV", "development").casefold() != "production":
			expected_key = demo_defaults[payload.role]
		else:
			expected_key = None
		if not expected_key or not role_registration_key or not hmac.compare_digest(
			role_registration_key,
			expected_key,
		):
			raise HTTPException(
				status_code=status.HTTP_403_FORBIDDEN,
				detail=f"A valid {payload.role} registration key is required",
			)

	existing_user = session.scalar(select(User).where(User.email == payload.email))
	if existing_user is not None:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already registered")

	user = User(
		email=payload.email,
		hashed_password=get_password_hash(payload.password),
		role=payload.role,
	)
	session.add(user)
	try:
		session.commit()
	except IntegrityError as error:
		session.rollback()
		raise HTTPException(status_code=400, detail="Email is already registered") from error
	return SignupResponse(detail="Account created successfully", role=user.role)


@router.post("/login", response_model=LoginResponse)
async def login(
	request: Request,
	session: Annotated[Session, Depends(get_db)],
) -> LoginResponse:
	payload = await _parse_login_payload(request)
	user = session.scalar(select(User).where(User.email == payload.email))
	if user is None or not user.is_active or not verify_password(
		payload.password,
		user.hashed_password if user is not None else "",
	):
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid email or password",
			headers={"WWW-Authenticate": "Bearer"},
		)
	if user.role != payload.expected_role:
		account_type = {
			"student": "Student",
			"recruiter": "HR / Recruiter",
			"admin": "Admin",
		}[user.role]
		portal_name = {
			"student": "Student Portal",
			"recruiter": "Recruiter Portal",
			"admin": "Admin Portal",
		}[payload.expected_role]
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail=f"This account is registered as a {account_type}. Please use the {portal_name} gateway.",
		)

	token = create_access_token(email=user.email, role=user.role)
	return LoginResponse(
		access_token=token,
		role=user.role,
	)


@router.get("/me", response_model=AuthenticatedUserResponse)
def get_authenticated_user(
	current_user: Annotated[User, Depends(get_current_user)],
) -> AuthenticatedUserResponse:
	return AuthenticatedUserResponse(
		email=current_user.email,
		role=current_user.role,
		is_active=current_user.is_active,
	)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
	payload: ForgotPasswordRequest,
	session: Annotated[Session, Depends(get_db)],
) -> ForgotPasswordResponse:
	user = session.scalar(select(User).where(User.email == payload.email))
	if user is None or not user.is_active:
		return ForgotPasswordResponse(
			detail="If an active account exists, password reset instructions were generated."
		)

	reset_token = secrets.token_urlsafe(32)
	user.reset_token = hash_reset_token(reset_token)
	user.reset_token_expires = (datetime.now(UTC) + RESET_TOKEN_LIFETIME).replace(tzinfo=None)
	session.commit()
	return ForgotPasswordResponse(
		detail="Password reset token generated for local testing.",
		reset_token=reset_token,
	)


@router.post("/reset-password", response_model=AuthMessageResponse)
def reset_password(
	payload: ResetPasswordRequest,
	session: Annotated[Session, Depends(get_db)],
) -> AuthMessageResponse:
	user = session.scalar(select(User).where(User.email == payload.email))
	if user is None or not user.is_active or not user.reset_token or not user.reset_token_expires:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

	expires_at = user.reset_token_expires
	if expires_at.tzinfo is None:
		expires_at = expires_at.replace(tzinfo=UTC)
	if expires_at <= datetime.now(UTC) or not hmac.compare_digest(
		user.reset_token,
		hash_reset_token(payload.reset_token),
	):
		if expires_at <= datetime.now(UTC):
			user.reset_token = None
			user.reset_token_expires = None
			session.commit()
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

	user.hashed_password = get_password_hash(payload.new_password)
	user.reset_token = None
	user.reset_token_expires = None
	session.commit()
	return AuthMessageResponse(detail="Password reset successfully")
