import hashlib
import os
import secrets
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

import backend.app.config  # noqa: F401  # load JWT settings from local .env files
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User

UserRole = Literal["student", "recruiter", "admin"]
VALID_ROLES = frozenset({"student", "recruiter", "admin"})
JWT_ALGORITHM = "HS256"
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
	if os.getenv("APP_ENV", "development").casefold() == "production":
		raise RuntimeError("JWT_SECRET_KEY must be configured in production")
	JWT_SECRET_KEY = secrets.token_urlsafe(48)

try:
	ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
except ValueError as error:
	raise RuntimeError("ACCESS_TOKEN_EXPIRE_MINUTES must be a positive integer") from error
if ACCESS_TOKEN_EXPIRE_MINUTES <= 0:
	raise RuntimeError("ACCESS_TOKEN_EXPIRE_MINUTES must be a positive integer")

password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_password_hash(password: str) -> str:
	"""Hash a validated password using bcrypt."""
	return password_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
	"""Safely verify a password, returning false for malformed stored hashes."""
	try:
		return password_context.verify(plain_password, hashed_password)
	except (TypeError, ValueError):
		return False


def hash_reset_token(token: str) -> str:
	"""Return a one-way digest so a database leak does not reveal reset tokens."""
	return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(
	*,
	email: str,
	role: UserRole,
	expires_delta: timedelta | None = None,
) -> str:
	"""Create an HS256 JWT carrying the subject, role, and expiration claim."""
	now = datetime.now(UTC)
	expires_at = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
	payload = {
		"sub": email,
		"role": role,
		"iat": now,
		"exp": expires_at,
	}
	return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user(
	token: Annotated[str, Depends(oauth2_scheme)],
	session: Annotated[Session, Depends(get_db)],
) -> User:
	"""Resolve a valid bearer token to an active database user."""
	unauthorized = HTTPException(
		status_code=status.HTTP_401_UNAUTHORIZED,
		detail="Invalid or expired access token",
		headers={"WWW-Authenticate": "Bearer"},
	)
	try:
		payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
		email = payload.get("sub")
		role = payload.get("role")
		if not isinstance(email, str) or not isinstance(role, str) or role not in VALID_ROLES:
			raise unauthorized
	except JWTError as error:
		raise unauthorized from error

	user = session.scalar(select(User).where(User.email == email))
	if user is None or not user.is_active or user.role != role:
		raise unauthorized
	return user


def require_roles(*allowed_roles: UserRole) -> Callable[..., User]:
	"""Build a FastAPI dependency that enforces one of the permitted roles."""
	if not allowed_roles or not set(allowed_roles) <= VALID_ROLES:
		raise ValueError("At least one valid role must be provided")

	def role_dependency(
		current_user: Annotated[User, Depends(get_current_user)],
	) -> User:
		if current_user.role not in allowed_roles:
			raise HTTPException(
				status_code=status.HTTP_403_FORBIDDEN,
				detail="Insufficient permissions",
			)
		return current_user

	return role_dependency
