import unittest
import os
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo
from fastapi.testclient import TestClient
from pydantic import ValidationError

from auth import cookie_name, rate_limit, token_digest
from main import app
from together import Preferences, make_plan


def member(alias, interests, budget=500, pace="balanced", must_haves=None):
    return {"alias": alias, "preferences": {"budget": budget, "pace": pace, "interests": interests, "must_haves": must_haves or []}}


class CompromiseTests(unittest.TestCase):
    def test_waits_for_every_member(self):
        self.assertFalse(make_plan([member("One", ["nature"])], 2, 100)["ready"])
        self.assertFalse(make_plan([member("One", ["nature"]), {"alias": "Two"}], 2, 100)["ready"])

    def test_split_pace_and_private_budget(self):
        members = [member("One", ["nature", "adventure"], 500, "full"), member("Two", ["culture", "relaxation"], 200, "relaxed")]
        plan = make_plan(members, 2, 300)
        self.assertEqual(plan["pace"], "relaxed")
        self.assertEqual(plan["budget_status"], "over")
        self.assertTrue(any(slot["split"] for slot in plan["slots"]))
        self.assertTrue(all(item["coverage"] == 100 for item in plan["fairness"]))
        self.assertNotIn("budget", plan["fairness"][0])
        self.assertNotIn("preferences", str(plan))

    def test_boundaries_and_must_haves(self):
        members = [member("One", ["nature", "culture", "food", "spiritual", "relaxation", "adventure", "shopping"], must_haves=["shopping", "spiritual"]), member("Two", ["culture"])]
        plan = make_plan(members, 1, 500)
        self.assertEqual(plan["budget_status"], "within")
        self.assertTrue(any(item["coverage"] < 100 for item in plan["fairness"]))
        self.assertEqual(make_plan(members, 1, None)["budget_status"], "missing")
        self.assertEqual(plan, make_plan(members, 1, 500))

    def test_invalid_preferences(self):
        base = member("One", ["nature"])["preferences"]
        for change in [{"budget": float("inf")}, {"budget": 0}, {"interests": []}, {"interests": ["nature", "nature"]}, {"must_haves": ["food"]}, {"pace": "unsafe"}, {"extra": "private"}]:
            with self.assertRaises(ValidationError):
                Preferences.model_validate(base | change)

    def test_split_only_credits_one_activity_per_person(self):
        members = [member("Many interests", ["nature", "culture", "food", "relaxation"]), member("Nature", ["nature"]), member("Food", ["food"])]
        plan = make_plan(members, 1, 100)
        self.assertLessEqual(plan["fairness"][0]["coverage"], 50)


class GroupAccessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.database_url = os.getenv("DATABASE_URL", "postgresql:///yatra")
        cls.schema = "together_test_" + uuid4().hex
        with psycopg.connect(cls.database_url) as connection:
            connection.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(cls.schema)))
        cls.environment = patch.dict(os.environ, {"DATABASE_URL": make_conninfo(cls.database_url, options=f"-csearch_path={cls.schema}")})
        cls.environment.start()
        with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
            connection.execute(Path(__file__).with_name("schema.sql").read_text())

    @classmethod
    def tearDownClass(cls):
        cls.environment.stop()
        with psycopg.connect(cls.database_url) as connection:
            connection.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(cls.schema)))

    def setUp(self):
        app.dependency_overrides[rate_limit] = lambda: None
        self.clients = []
        for index in range(3):
            client = TestClient(app, headers={"X-Yatra-Request": "1", "Origin": "http://127.0.0.1:3000"})
            token = (str(index) + uuid4().hex + uuid4().hex)[:43]
            with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
                user_id = uuid4()
                connection.execute("INSERT INTO users (id, email, whatsapp, password_hash, location) VALUES (%s, %s, %s, 'unused', 'Test')", (user_id, f"member{index}@example.org", f"+1202555012{index}"))
                connection.execute("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, CURRENT_TIMESTAMP + INTERVAL '1 hour')", (token_digest(token), user_id))
            client.cookies.set(cookie_name, token)
            self.clients.append(client)
        self.owner, self.guest, self.outsider = self.clients
        result = self.owner.post("/together", json={"title": "Group test", "destination": "Kyoto", "alias": "Organiser", "days": 2, "currency": "JPY", "proposed_cost": 300})
        self.assertEqual(result.status_code, 201, result.text)
        self.path = "/together/" + result.json()["id"]

    def tearDown(self):
        for client in self.clients:
            client.close()
        app.dependency_overrides.clear()
        with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
            connection.execute("DELETE FROM users")

    def invite_guest(self):
        code = self.owner.post(self.path + "/invite").json()["code"]
        response = self.guest.post("/together/join", json={"code": code, "alias": "Guest"})
        self.assertEqual(response.status_code, 200, response.text)
        return code

    def test_private_submissions_and_membership(self):
        self.assertEqual(self.outsider.get(self.path).status_code, 404)
        self.assertEqual(self.outsider.get("/together").json(), [])
        self.invite_guest()
        first = member("Organiser", ["nature"], 54321)["preferences"]
        second = member("Guest", ["culture"], 12345)["preferences"]
        self.assertEqual(self.owner.put(self.path + "/preferences", json=first).status_code, 200)
        response = self.guest.put(self.path + "/preferences", json=second)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn("54321", response.text)
        self.assertTrue(response.json()["plan"]["ready"])
        owner_response = self.owner.get(self.path)
        self.assertNotIn("12345", owner_response.text)
        self.assertEqual(owner_response.json()["my_preferences"], first)
        self.assertEqual(owner_response.headers["cache-control"], "no-store")
        self.assertEqual(self.outsider.put(self.path + "/preferences", json=second).status_code, 404)
        self.assertEqual(self.guest.put(self.path, json={"days": 3, "proposed_cost": 4}).status_code, 403)
        self.assertFalse(self.guest.delete(self.path + "/preferences").json()["plan"]["ready"])

    def test_invite_rotation_revocation_and_expiry(self):
        old_code = self.invite_guest()
        self.assertEqual(self.guest.post(self.path + "/invite").status_code, 403)
        new_code = self.owner.post(self.path + "/invite").json()["code"]
        self.assertEqual(self.outsider.post("/together/join", json={"code": old_code, "alias": "Third"}).status_code, 404)
        self.owner.delete(self.path + "/invite")
        self.assertEqual(self.outsider.post("/together/join", json={"code": new_code, "alias": "Third"}).status_code, 404)
        code = self.owner.post(self.path + "/invite").json()["code"]
        with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
            connection.execute("UPDATE together_trips SET invite_expires = CURRENT_TIMESTAMP - INTERVAL '1 second'")
        self.assertEqual(self.outsider.post("/together/join", json={"code": code, "alias": "Third"}).status_code, 404)

    def test_leave_delete_and_csrf(self):
        self.invite_guest()
        self.assertEqual(self.owner.post(self.path + "/invite", headers={"Origin": "https://untrusted.example"}).status_code, 403)
        self.assertEqual(self.owner.put(self.path, json={"days": 0}).status_code, 422)
        self.assertEqual(self.guest.delete(self.path).status_code, 204)
        self.assertEqual(self.guest.get(self.path).status_code, 404)
        self.assertEqual(self.owner.get(self.path).status_code, 200)
        self.assertEqual(self.owner.delete(self.path).status_code, 204)
        self.assertEqual(self.owner.get(self.path).status_code, 404)
        with TestClient(app) as anonymous:
            self.assertEqual(anonymous.get("/together").status_code, 401)


if __name__ == "__main__":
    unittest.main()