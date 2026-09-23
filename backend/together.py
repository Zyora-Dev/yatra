from collections import Counter
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, model_validator

from auth import connect, me, rate_limit, require_write_header, token_digest

router = APIRouter(prefix="/together", tags=["trip together"])
write_checks = [Depends(require_write_header), Depends(rate_limit)]

Interest = Literal["culture", "nature", "food", "spiritual", "relaxation", "adventure", "shopping"]
Pace = Literal["relaxed", "balanced", "full"]
Currency = Literal["INR", "USD", "EUR", "GBP", "JPY", "AED", "SGD", "AUD"]
themes = ["culture", "nature", "food", "spiritual", "relaxation", "adventure", "shopping"]


class Preferences(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    budget: float = Field(gt=0, le=100000000)
    pace: Pace
    interests: list[Interest] = Field(min_length=1, max_length=7)
    must_haves: list[Interest] = Field(default_factory=list, max_length=7)

    @model_validator(mode="after")
    def validate_choices(self):
        if len(set(self.interests)) != len(self.interests) or len(set(self.must_haves)) != len(self.must_haves):
            raise ValueError("Choose each interest only once.")
        if not set(self.must_haves).issubset(self.interests):
            raise ValueError("Must-haves must also be selected interests.")
        return self


def make_plan(members: list[dict], days: int, proposed_cost: float | None):
    submitted = [member for member in members if member.get("preferences")]
    if len(members) < 2 or len(submitted) != len(members):
        return {"ready": False, "submitted": len(submitted), "members": len(members)}
    preferences = [Preferences.model_validate(member["preferences"]) for member in submitted]
    covered: set[str] = set()
    individual_coverage = [set() for item in preferences]
    slots = []
    pace_order = {"relaxed": 0, "balanced": 1, "full": 2}
    shared_pace = min((item.pace for item in preferences), key=pace_order.get)

    def score(theme):
        satisfaction = [len((individual_coverage[index] | {theme}).intersection(item.interests)) / len(item.interests) for index, item in enumerate(preferences)]
        must_votes = sum(theme in item.must_haves for item in preferences)
        votes = sum(theme in item.interests for item in preferences)
        return (min(satisfaction), must_votes, sum(satisfaction), votes, -themes.index(theme))

    for slot in range(days * 2):
        available = [theme for theme in themes if theme not in covered and any(theme in item.interests for item in preferences)]
        if not available:
            slots.append({"day": slot // 2 + 1, "period": "Morning" if slot % 2 == 0 else "Afternoon", "themes": ["free time"], "split": False})
            continue
        chosen = max(available, key=score)
        covered.add(chosen)
        selected = [chosen]
        if slot % 2 == 1:
            underserved = [item for item in preferences if chosen not in item.interests]
            alternatives = [theme for theme in available if theme != chosen and any(theme in item.interests for item in underserved)]
            if alternatives:
                alternate = max(alternatives, key=score)
                covered.add(alternate)
                selected.append(alternate)
        for index, preference in enumerate(preferences):
            relevant = [theme for theme in selected if theme in preference.interests]
            if relevant:
                attended = max(relevant, key=lambda theme: (theme in preference.must_haves and theme not in individual_coverage[index], theme not in individual_coverage[index]))
                individual_coverage[index].add(attended)
        slots.append({"day": slot // 2 + 1, "period": "Morning" if slot % 2 == 0 else "Afternoon", "themes": selected, "split": len(selected) > 1})

    fairness = []
    missing_musts = set()
    for index, (member, preference) in enumerate(zip(submitted, preferences)):
        matched = len(individual_coverage[index].intersection(preference.interests))
        missing = set(preference.must_haves) - individual_coverage[index]
        missing_musts.update(missing)
        fairness.append({"alias": member["alias"], "coverage": round(matched / len(preference.interests) * 100), "must_haves_met": not missing})
    lowest = min(item["coverage"] for item in fairness)
    overlooked = [item["alias"] for item in fairness if item["coverage"] == lowest and lowest < 100]
    counts = Counter(item.pace for item in preferences)
    budget_status = "missing" if proposed_cost is None else "within" if all(proposed_cost <= item.budget for item in preferences) else "over"
    if missing_musts:
        adjustment = "Replace a free or optional block with " + ", ".join(sorted(missing_musts)) + "; some must-haves are still unmet."
    elif overlooked:
        adjustment = "Give " + ", ".join(overlooked) + " first choice of the next optional block; their interests have the lowest coverage."
    elif budget_status == "over":
        adjustment = "Reduce the proposed per-person cost before agreeing the plan; at least one private spending limit is exceeded."
    elif len(counts) > 1:
        adjustment = "Keep shared blocks at the gentlest requested pace, with optional extra activities for those who want a fuller day."
    else:
        adjustment = "Keep one flexible block and confirm the actual travel times and costs together before finalising."
    return {
        "ready": True, "submitted": len(submitted), "members": len(members),
        "pace": shared_pace, "different_paces": len(counts) > 1,
        "budget_status": budget_status, "slots": slots, "fairness": fairness,
        "adjustment": adjustment,
    }


class TripInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)
    title: str = Field(min_length=1, max_length=100)
    destination: str = Field(min_length=2, max_length=160)
    alias: str = Field(min_length=1, max_length=40)
    days: int = Field(ge=1, le=14)
    currency: Currency
    proposed_cost: float | None = Field(default=None, ge=0, le=100000000)


class TripUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    days: int = Field(ge=1, le=14)
    proposed_cost: float | None = Field(default=None, ge=0, le=100000000)


class JoinInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    code: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
    alias: str = Field(min_length=1, max_length=40)


def access_trip(connection, trip_id, user_id, owner=False):
    trip = connection.execute("SELECT * FROM together_trips WHERE id = %s FOR UPDATE", (trip_id,)).fetchone()
    membership = connection.execute("SELECT 1 FROM together_members WHERE trip_id = %s AND user_id = %s", (trip_id, user_id)).fetchone()
    if not trip or not membership:
        raise HTTPException(404, "Trip not found or you are not a member.")
    if owner and trip["owner_id"] != user_id:
        raise HTTPException(403, "Only the organiser can change this trip.")
    return trip


def check_trip_limit(connection, user_id):
    connection.execute("SELECT id FROM users WHERE id = %s FOR UPDATE", (user_id,))
    count = connection.execute("SELECT count(*) AS count FROM together_members WHERE user_id = %s", (user_id,)).fetchone()["count"]
    if count >= 20:
        raise HTTPException(409, "Leave or delete an older trip before adding another. Limit: 20 trips.")


def trip_view(connection, trip, user_id):
    members = connection.execute("SELECT user_id, alias, preferences FROM together_members WHERE trip_id = %s ORDER BY joined_at, user_id", (trip["id"],)).fetchall()
    own = next(member for member in members if member["user_id"] == user_id)
    return {
        "id": trip["id"], "title": trip["title"], "destination": trip["destination"],
        "days": trip["days"], "currency": trip["currency"], "proposed_cost": trip["proposed_cost"],
        "created_at": trip["created_at"], "is_owner": trip["owner_id"] == user_id,
        "my_preferences": own["preferences"], "my_alias": own["alias"],
        "members": [{"alias": member["alias"], "submitted": member["preferences"] is not None} for member in members],
        "plan": make_plan(members, trip["days"], trip["proposed_cost"]),
    }


@router.get("")
def list_trips(response: Response, user=Depends(me)):
    response.headers["Cache-Control"] = "no-store"
    with connect() as connection:
        return connection.execute(
            "SELECT trip.id, trip.title, trip.destination, trip.days, trip.currency, trip.created_at "
            "FROM together_trips trip JOIN together_members member ON member.trip_id = trip.id "
            "WHERE member.user_id = %s ORDER BY trip.created_at DESC", (user["id"],),
        ).fetchall()


@router.post("", status_code=201, dependencies=write_checks)
def create_trip(payload: TripInput, response: Response, user=Depends(me)):
    response.headers["Cache-Control"] = "no-store"
    with connect() as connection:
        check_trip_limit(connection, user["id"])
        trip = connection.execute(
            "INSERT INTO together_trips (id, owner_id, title, destination, days, currency, proposed_cost) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *",
            (uuid4(), user["id"], payload.title, payload.destination, payload.days, payload.currency, payload.proposed_cost),
        ).fetchone()
        connection.execute("INSERT INTO together_members (trip_id, user_id, alias) VALUES (%s, %s, %s)", (trip["id"], user["id"], payload.alias))
        return trip_view(connection, trip, user["id"])


@router.post("/join", dependencies=write_checks)
def join_trip(payload: JoinInput, response: Response, user=Depends(me)):
    response.headers["Cache-Control"] = "no-store"
    with connect() as connection:
        trip = connection.execute(
            "SELECT * FROM together_trips WHERE invite_hash = %s AND invite_expires > CURRENT_TIMESTAMP FOR UPDATE",
            (token_digest(payload.code),),
        ).fetchone()
        if not trip:
            raise HTTPException(404, "Invite is invalid, expired or revoked.")
        existing = connection.execute("SELECT 1 FROM together_members WHERE trip_id = %s AND user_id = %s", (trip["id"], user["id"])).fetchone()
        if not existing:
            check_trip_limit(connection, user["id"])
            members = connection.execute("SELECT alias FROM together_members WHERE trip_id = %s", (trip["id"],)).fetchall()
            if len(members) >= 12:
                raise HTTPException(409, "This trip already has 12 travellers.")
            if any(member["alias"].casefold() == payload.alias.casefold() for member in members):
                raise HTTPException(409, "Choose a different display name for this trip.")
            connection.execute("INSERT INTO together_members (trip_id, user_id, alias) VALUES (%s, %s, %s)", (trip["id"], user["id"], payload.alias))
        return trip_view(connection, trip, user["id"])


@router.get("/{trip_id}")
def get_trip(trip_id: UUID, response: Response, user=Depends(me)):
    response.headers["Cache-Control"] = "no-store"
    with connect() as connection:
        trip = access_trip(connection, trip_id, user["id"])
        return trip_view(connection, trip, user["id"])


@router.put("/{trip_id}", dependencies=write_checks)
def update_trip(trip_id: UUID, payload: TripUpdate, response: Response, user=Depends(me)):
    response.headers["Cache-Control"] = "no-store"
    with connect() as connection:
        access_trip(connection, trip_id, user["id"], owner=True)
        trip = connection.execute("UPDATE together_trips SET days = %s, proposed_cost = %s WHERE id = %s RETURNING *", (payload.days, payload.proposed_cost, trip_id)).fetchone()
        return trip_view(connection, trip, user["id"])


@router.put("/{trip_id}/preferences", dependencies=write_checks)
def save_preferences(trip_id: UUID, payload: Preferences, response: Response, user=Depends(me)):
    response.headers["Cache-Control"] = "no-store"
    with connect() as connection:
        trip = access_trip(connection, trip_id, user["id"])
        connection.execute("UPDATE together_members SET preferences = %s WHERE trip_id = %s AND user_id = %s", (Jsonb(payload.model_dump()), trip_id, user["id"]))
        return trip_view(connection, trip, user["id"])


@router.delete("/{trip_id}/preferences", dependencies=write_checks)
def withdraw_preferences(trip_id: UUID, response: Response, user=Depends(me)):
    response.headers["Cache-Control"] = "no-store"
    with connect() as connection:
        trip = access_trip(connection, trip_id, user["id"])
        connection.execute("UPDATE together_members SET preferences = NULL WHERE trip_id = %s AND user_id = %s", (trip_id, user["id"]))
        return trip_view(connection, trip, user["id"])


@router.post("/{trip_id}/invite", dependencies=write_checks)
def create_invite(trip_id: UUID, response: Response, user=Depends(me)):
    response.headers["Cache-Control"] = "no-store"
    with connect() as connection:
        access_trip(connection, trip_id, user["id"], owner=True)
        code = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(days=7)
        connection.execute("UPDATE together_trips SET invite_hash = %s, invite_expires = %s WHERE id = %s", (token_digest(code), expires, trip_id))
        return {"code": code, "expires_at": expires}


@router.delete("/{trip_id}/invite", status_code=204, dependencies=write_checks)
def revoke_invite(trip_id: UUID, response: Response, user=Depends(me)):
    response.headers["Cache-Control"] = "no-store"
    with connect() as connection:
        access_trip(connection, trip_id, user["id"], owner=True)
        connection.execute("UPDATE together_trips SET invite_hash = NULL, invite_expires = NULL WHERE id = %s", (trip_id,))


@router.delete("/{trip_id}", status_code=204, dependencies=write_checks)
def delete_trip(trip_id: UUID, response: Response, user=Depends(me)):
    response.headers["Cache-Control"] = "no-store"
    with connect() as connection:
        trip = access_trip(connection, trip_id, user["id"])
        if trip["owner_id"] == user["id"]:
            connection.execute("DELETE FROM together_trips WHERE id = %s", (trip_id,))
        else:
            connection.execute("DELETE FROM together_members WHERE trip_id = %s AND user_id = %s", (trip_id, user["id"]))