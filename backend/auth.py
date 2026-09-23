import hashlib
import os
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock
from uuid import UUID, uuid4

import phonenumbers
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from psycopg.rows import dict_row
from pwdlib import PasswordHash
from pydantic import BaseModel, EmailStr, Field, field_validator

router = APIRouter(prefix="/auth", tags=["authentication"])
password_hasher = PasswordHash.recommended()
dummy_hash = password_hasher.hash(secrets.token_urlsafe(32))
cookie_name = "yatra_session"
session_seconds = 7 * 24 * 60 * 60
trusted_origins = set(os.getenv(
    "TRUSTED_ORIGINS",
    "http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:8800,http://localhost:8800",
).split(","))
attempts: dict[str, deque[float]] = defaultdict(deque)
attempt_lock = Lock()


def connect():
    return psycopg.connect(
        os.getenv("DATABASE_URL", "postgresql:///yatra"),
        row_factory=dict_row,
        connect_timeout=5,
    )


def normalise_phone(value: str) -> str:
    value = value.strip()
    if not value.startswith("+"):
        raise ValueError("Include the country code, for example +91 or +44.")
    try:
        number = phonenumbers.parse(value, None)
    except phonenumbers.NumberParseException:
        raise ValueError("Enter a valid WhatsApp number with country code.") from None
    if number.extension or not phonenumbers.is_valid_number(number):
        raise ValueError("Enter a valid WhatsApp number with country code.")
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)


class Registration(BaseModel):
    email: EmailStr = Field(max_length=254)
    whatsapp: str = Field(min_length=8, max_length=40)
    password: str = Field(min_length=15, max_length=128)
    location: str = Field(min_length=1, max_length=160)

    @field_validator("email", mode="before")
    @classmethod
    def normalise_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("whatsapp")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        return normalise_phone(value)

    @field_validator("location")
    @classmethod
    def validate_location(cls, value: str) -> str:
        value = value.strip()
        if not value or any(ord(character) < 32 for character in value):
            raise ValueError("Enter your city and country.")
        return value


class Login(BaseModel):
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class User(BaseModel):
    id: UUID
    email: EmailStr
    whatsapp: str
    location: str
    created_at: datetime


def require_write_header(request: Request):
    origin = request.headers.get("origin")
    if request.headers.get("x-yatra-request") != "1" or (origin and origin not in trusted_origins):
        raise HTTPException(403, "Request origin could not be verified.")


def rate_limit(request: Request):
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with attempt_lock:
        for address in list(attempts):
            while attempts[address] and attempts[address][0] <= now - 900:
                attempts[address].popleft()
            if not attempts[address]:
                del attempts[address]
        if len(attempts[client]) >= 20:
            raise HTTPException(429, "Too many attempts. Please try again later.", headers={"Retry-After": "900"})
        attempts[client].append(now)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(connection, user_id: UUID, request: Request, response: Response):
    previous = request.cookies.get(cookie_name)
    if previous:
        connection.execute("DELETE FROM sessions WHERE token_hash = %s", (token_digest(previous),))
    connection.execute("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP")
    token = secrets.token_urlsafe(32)
    connection.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
        (token_digest(token), user_id, datetime.now(timezone.utc) + timedelta(seconds=session_seconds)),
    )
    response.set_cookie(
        cookie_name, token, max_age=session_seconds, httponly=True,
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        samesite="lax", path="/",
    )
    response.headers["Cache-Control"] = "no-store"


@router.post("/register", response_model=User, status_code=201,
             dependencies=[Depends(require_write_header), Depends(rate_limit)])
def register(payload: Registration, request: Request, response: Response):
    hashed_password = password_hasher.hash(payload.password)
    try:
        with connect() as connection:
            user = connection.execute(
                "INSERT INTO users (id, email, whatsapp, password_hash, location) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id, email, whatsapp, location, created_at",
                (uuid4(), str(payload.email), payload.whatsapp, hashed_password, payload.location),
            ).fetchone()
            create_session(connection, user["id"], request, response)
        return user
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "An account with that email or WhatsApp number already exists.") from None


@router.post("/login", response_model=User,
             dependencies=[Depends(require_write_header), Depends(rate_limit)])
def login(payload: Login, request: Request, response: Response):
    identifier = payload.identifier.strip().lower()
    if "@" not in identifier:
        try:
            identifier = normalise_phone(identifier)
        except ValueError:
            identifier = ""
    with connect() as connection:
        user = connection.execute(
            "SELECT id, email, whatsapp, password_hash, location, created_at FROM users "
            "WHERE email = %s OR whatsapp = %s", (identifier, identifier),
        ).fetchone()
        valid, updated_hash = password_hasher.verify_and_update(
            payload.password, user["password_hash"] if user else dummy_hash,
        )
        if not user or not valid:
            raise HTTPException(401, "Incorrect email/WhatsApp number or password.")
        if updated_hash:
            connection.execute("UPDATE users SET password_hash = %s WHERE id = %s", (updated_hash, user["id"]))
        create_session(connection, user["id"], request, response)
    return user


@router.get("/me", response_model=User)
def me(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    token = request.cookies.get(cookie_name, "")
    if len(token) != 43:
        raise HTTPException(401, "Please sign in.")
    with connect() as connection:
        user = connection.execute(
            "SELECT users.id, users.email, users.whatsapp, users.location, users.created_at "
            "FROM users JOIN sessions ON sessions.user_id = users.id "
            "WHERE sessions.token_hash = %s AND sessions.expires_at > CURRENT_TIMESTAMP",
            (token_digest(token),),
        ).fetchone()
    if not user:
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    return user


@router.post("/logout", status_code=204, dependencies=[Depends(require_write_header)])
def logout(request: Request, response: Response):
    token = request.cookies.get(cookie_name)
    if token:
        with connect() as connection:
            connection.execute("DELETE FROM sessions WHERE token_hash = %s", (token_digest(token),))
    response.delete_cookie(cookie_name, path="/", httponly=True, samesite="lax",
                           secure=os.getenv("COOKIE_SECURE", "false").lower() == "true")
    response.headers["Cache-Control"] = "no-store"