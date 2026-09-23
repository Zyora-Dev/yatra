import test from "node:test";
import assert from "node:assert/strict";
import { destinations, pilgrimagePlaces, photoCredits, searchDestinations, nearestDestination } from "./destinations.ts";

test("search matches cities, countries and religious landmarks", () => {
  assert.equal(searchDestinations("  BALI ")[0].id, "bali");
  assert.ok(searchDestinations("India").length > destinations.length / 2);
  assert.equal(searchDestinations("Taj Mahal")[0].id, "agra");
  assert.equal(searchDestinations("church")[0].id, "cinque-terre");
});
test("category and region filters combine with search", () => {
  assert.ok(searchDestinations("", "nature", "india").some((place) => place.id === "varkala"));
  assert.ok(searchDestinations("", "spiritual", "international").every((place) => place.country !== "India"));
  assert.equal(searchDestinations("nonexistent place").length, 0);
});
test("Indian hero destinations and six searchable pilgrimage choices have photo credits", () => {
  assert.deepEqual(destinations.slice(0, 4).map((place) => place.id), ["jammu", "darjeeling", "varkala", "goa"]);
  assert.equal(pilgrimagePlaces.length, 6);
  assert.equal(new Set(pilgrimagePlaces.map((place) => place.id)).size, 6);
  assert.ok(pilgrimagePlaces.every((place) => place.query.includes("India")));
  assert.equal(photoCredits.length, 10);
});
test("nearby search ranks the sample collection and rejects invalid coordinates", () => {
  assert.equal(nearestDestination(27.1767, 78.0081).destination.id, "agra");
  assert.equal(nearestDestination(27.1767, 78.0081).distanceKm, 0);
  assert.throws(() => nearestDestination(NaN, 0));
  assert.throws(() => nearestDestination(100, 0));
});