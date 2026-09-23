import os
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import psycopg
from fastapi.testclient import TestClient
from psycopg import sql
from psycopg.conninfo import make_conninfo

from auth import attempts, cookie_name, password_hasher, rate_limit, token_digest
from main import app


class AuthenticationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.database_url = os.getenv("DATABASE_URL", "postgresql:///yatra")
        cls.schema = "auth_test_" + uuid4().hex
        with psycopg.connect(cls.database_url) as connection:
            connection.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(cls.schema)))
        cls.environment = patch.dict(os.environ, {
            "DATABASE_URL": make_conninfo(cls.database_url, options=f"-csearch_path={cls.schema}"),
            "COOKIE_SECURE": "false",
        })
        cls.environment.start()
        with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
            connection.execute(Path(__file__).with_name("schema.sql").read_text())

    @classmethod
    def tearDownClass(cls):
        cls.environment.stop()
        with psycopg.connect(cls.database_url) as connection:
            connection.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(cls.schema)))

    def setUp(self):
        self.client = TestClient(app, headers={"X-Yatra-Request": "1", "Origin": "http://127.0.0.1:3000"})
        app.dependency_overrides[rate_limit] = lambda: None
        self.payload = {
            "email": "traveller@example.org", "whatsapp": "+12025550123",
            "password": "A long test passphrase!", "location": "London, United Kingdom",
        }

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        attempts.clear()
        with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
            connection.execute("DELETE FROM sessions")
            connection.execute("DELETE FROM users")

    def test_register_hash_session_and_logout(self):
        response = self.client.post("/auth/register", json=self.payload)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertNotIn("password", response.text)
        cookie = response.headers["set-cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=lax", cookie)
        token = self.client.cookies.get(cookie_name)
        with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
            password_hash = connection.execute("SELECT password_hash FROM users").fetchone()[0]
            session_hash = connection.execute("SELECT token_hash FROM sessions").fetchone()[0]
        self.assertTrue(password_hash.startswith("$argon2id$"))
        self.assertTrue(password_hasher.verify(self.payload["password"], password_hash))
        self.assertEqual(session_hash, token_digest(token))
        self.assertNotEqual(session_hash, token)
        self.assertEqual(self.client.get("/auth/me").json()["email"], self.payload["email"])
        self.assertEqual(self.client.post("/auth/logout").status_code, 204)
        self.client.cookies.set(cookie_name, token)
        self.assertEqual(self.client.get("/auth/me").status_code, 401)

    def test_login_email_phone_and_wrong_credentials(self):
        self.assertEqual(self.client.post("/auth/register", json=self.payload).status_code, 201)
        for identifier in [" TRAVELLER@EXAMPLE.ORG ", "+1 (202) 555-0123"]:
            self.client.post("/auth/logout")
            response = self.client.post("/auth/login", json={"identifier": identifier, "password": self.payload["password"]})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertNotIn("password_hash", response.text)
        for identifier in [self.payload["email"], "missing@example.org", "+123", "' OR 1=1 --"]:
            response = self.client.post("/auth/login", json={"identifier": identifier, "password": "wrong"})
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json()["detail"], "Incorrect email/WhatsApp number or password.")

    def test_duplicate_email_and_phone(self):
        self.assertEqual(self.client.post("/auth/register", json=self.payload).status_code, 201)
        duplicate_email = dict(self.payload, email="TRAVELLER@EXAMPLE.ORG", whatsapp="+12025550124")
        self.assertEqual(self.client.post("/auth/register", json=duplicate_email).status_code, 409)
        duplicate_phone = dict(self.payload, email="second@example.org", whatsapp="+1 202 555 0123")
        self.assertEqual(self.client.post("/auth/register", json=duplicate_phone).status_code, 409)

    def test_validation_does_not_echo_password(self):
        for key, value in [("email", "bad"), ("whatsapp", "2025550123"), ("location", "  "), ("password", "short-secret")]:
            response = self.client.post("/auth/register", json=dict(self.payload, **{key: value}))
            self.assertEqual(response.status_code, 422)
            self.assertNotIn("short-secret", response.text)
            self.assertNotIn(self.payload["password"], response.text)

    def test_csrf_and_rate_limit(self):
        self.assertEqual(self.client.post("/auth/register", json=self.payload, headers={"Origin": "https://untrusted.example"}).status_code, 403)
        self.assertEqual(self.client.post("/auth/register", json=self.payload, headers={"X-Yatra-Request": ""}).status_code, 403)
        app.dependency_overrides.clear()
        for attempt in range(20):
            response = self.client.post("/auth/login", json={"identifier": "missing@example.org", "password": ""})
            self.assertEqual(response.status_code, 422)
        response = self.client.post("/auth/login", json={"identifier": "missing@example.org", "password": ""})
        self.assertEqual(response.status_code, 429)
        self.assertIn("Retry-After", response.headers)

    def test_expiration_rotation_and_user_isolation(self):
        first = self.client.post("/auth/register", json=self.payload).json()
        old_token = self.client.cookies.get(cookie_name)
        self.client.post("/auth/login", json={"identifier": self.payload["email"], "password": self.payload["password"]})
        with TestClient(app) as other:
            other.cookies.set(cookie_name, old_token)
            self.assertEqual(other.get("/auth/me").status_code, 401)
            second = other.post("/auth/register", json=dict(self.payload, email="other@example.org", whatsapp="+12025550124"), headers={"X-Yatra-Request": "1"})
            self.assertEqual(second.status_code, 201)
            self.assertNotEqual(other.get("/auth/me").json()["id"], first["id"])
        self.assertEqual(self.client.get("/auth/me").json()["id"], first["id"])
        with psycopg.connect(os.environ["DATABASE_URL"]) as connection:
            connection.execute("UPDATE sessions SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'")
        self.assertEqual(self.client.get("/auth/me").status_code, 401)


if __name__ == "__main__":
    unittest.main()