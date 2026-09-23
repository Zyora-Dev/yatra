import json
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app
from travel import requests, safe_url


class TravelTests(unittest.TestCase):
    def setUp(self):
        requests.clear()
        self.client = TestClient(app, headers={"X-Yatra-Request": "1"})
        self.destination = {"id": "city", "location": {"latitude": 11, "longitude": 76}, "types": ["locality"]}

    def test_validation_and_origin(self):
        self.assertEqual(self.client.post("/travel/nearby", json={"place_id": "../bad"}).status_code, 422)
        self.assertEqual(self.client.post("/travel/nearby", json={"place_id": "city", "radius_km": 51}).status_code, 422)
        self.assertEqual(self.client.post("/travel/destinations", json={"query": "London"}, headers={"Origin": "https://evil.example"}).status_code, 403)
        self.assertEqual(self.client.get("/travel/photo?name=https://evil.example").status_code, 422)
        self.assertIsNone(safe_url("javascript:alert(1)"))

    def test_nearby_mask_radius_and_missing_data(self):
        with patch("travel.google", new=AsyncMock(side_effect=[self.destination, {"places": [{"id": "sight"}]}])) as provider:
            result = self.client.post("/travel/nearby", json={"place_id": "city", "radius_km": 25})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.headers["cache-control"], "no-store")
            self.assertEqual(provider.call_args.args[2]["locationRestriction"]["circle"]["radius"], 25000)
            self.assertNotIn("*", provider.call_args.args[1])
            self.assertNotIn("internationalPhoneNumber", result.json()["places"][0])

    def test_country_requires_locality(self):
        with patch("travel.google", new=AsyncMock(return_value={"types": ["country"]})) as provider:
            self.assertEqual(self.client.post("/travel/nearby", json={"place_id": "country"}).status_code, 422)
            self.assertEqual(provider.call_count, 1)

    def test_restaurant_search_and_details(self):
        restaurant = {"id": "restaurant", "primaryType": "restaurant", "displayName": {"text": "Test restaurant"}}
        with patch("travel.google", new=AsyncMock(side_effect=[self.destination, {"places": [restaurant]}])) as provider:
            result = self.client.post("/travel/nearby", json={"place_id": "city", "category": "restaurants", "radius_km": 5})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["places"][0]["id"], "restaurant")
            self.assertEqual(provider.call_args.args[2]["includedTypes"], ["restaurant"])
            self.assertEqual(provider.call_args.args[2]["locationRestriction"]["circle"]["radius"], 5000)
        detail = restaurant | {"internationalPhoneNumber": "+1 202-555-0100", "websiteUri": "https://example.com",
                               "rating": 4.5, "userRatingCount": 12, "regularOpeningHours": {"weekdayDescriptions": ["Monday: 12:00-20:00"]}}
        with patch("travel.google", new=AsyncMock(return_value=detail)) as provider:
            result = self.client.post("/travel/details", json={"place_id": "restaurant"})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["regularOpeningHours"], detail["regularOpeningHours"])
            self.assertEqual(result.json()["internationalPhoneNumber"], detail["internationalPhoneNumber"])
            for field in ("internationalPhoneNumber", "websiteUri", "rating", "userRatingCount", "regularOpeningHours"):
                self.assertIn(field, provider.call_args.args[1].split(","))

    def test_restaurant_shortlist_uses_category(self):
        restaurant = {"id": "restaurant"}
        reply = {"choices": [{"message": {"content": '{"place_ids":["restaurant"]}'}}]}
        with patch("travel.google", new=AsyncMock(side_effect=[self.destination, {"places": [restaurant]}])) as provider, patch("travel.azure_json", new=AsyncMock(return_value=reply)):
            result = self.client.post("/travel/suggestions", json={"place_id": "city", "category": "restaurants", "preferences": "Local food"})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["places"][0]["id"], "restaurant")
            self.assertEqual(provider.call_args.args[2]["includedTypes"], ["restaurant"])

    def test_provider_failure_is_sanitized(self):
        import httpx
        with patch("httpx.AsyncClient.request", new=AsyncMock(side_effect=httpx.ConnectError("secret detail"))):
            result = self.client.post("/travel/destinations", json={"query": "London"})
            self.assertEqual(result.status_code, 502)
            self.assertNotIn("secret detail", result.text)

    def test_ai_ignores_unknown_and_duplicate_ids(self):
        candidate = {"id": "real", "displayName": {"text": "Test place"}}
        reply = {"choices": [{"message": {"content": '{"place_ids":["invented","real","real"]}'}}]}
        with patch("travel.get_nearby", new=AsyncMock(return_value={"places": [candidate]})), patch("travel.provider_json", new=AsyncMock(return_value=reply)):
            result = self.client.post("/travel/suggestions", json={"place_id": "city", "preferences": "Quiet parks"})
            self.assertEqual(result.status_code, 200)
            self.assertEqual([place["id"] for place in result.json()["places"]], ["real"])

    def test_budget_uses_destination_and_calculates_ranges(self):
        rates = {"stay": {"low": 100, "high": 200}, "food": {"low": 20, "high": 40},
                 "transport": {"low": 30, "high": 50}, "activities": {"low": 10, "high": 20}}
        reply = {"choices": [{"message": {"content": json.dumps(rates)}}]}
        with patch("travel.google", new=AsyncMock(return_value=self.destination)) as places, patch("travel.azure_json", new=AsyncMock(return_value=reply)) as model:
            result = self.client.post("/travel/budget", json={"place_id": "city", "days": 3, "nights": 2, "travellers": 2, "rooms": 1})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["total"], {"low": 430, "high": 830})
            self.assertEqual(result.json()["per_person"], {"low": 215, "high": 415})
            self.assertEqual(result.headers["cache-control"], "no-store")
            self.assertEqual(places.call_args.args[0], "places/city")
            self.assertEqual(model.call_args.args[1]["destination"], self.destination)

    def test_budget_rejects_bad_counts_and_ai_rates(self):
        payload = {"place_id": "city", "days": 3, "nights": 2, "travellers": 2, "rooms": 1}
        for change in ({"days": 0}, {"travellers": 0}, {"nights": 4}, {"rooms": 3}, {"currency": "INVALID"}):
            self.assertEqual(self.client.post("/travel/budget", json=payload | change).status_code, 422)
        for invalid in ({"low": -1, "high": 2}, {"low": 3, "high": 2}, {"low": "free", "high": 2}, {"low": float("inf"), "high": float("inf")}):
            rates = {name: invalid for name in ("stay", "food", "transport", "activities")}
            reply = {"choices": [{"message": {"content": json.dumps(rates)}}]}
            requests.clear()
            with patch("travel.google", new=AsyncMock(return_value=self.destination)), patch("travel.azure_json", new=AsyncMock(return_value=reply)):
                self.assertEqual(self.client.post("/travel/budget", json=payload).status_code, 502)


if __name__ == "__main__":
    unittest.main()